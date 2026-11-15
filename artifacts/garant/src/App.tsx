import { useEffect, useLayoutEffect, useState, createContext, useContext, type FormEvent, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  useHealthCheck, getHealthCheckQueryKey, useGetMerchantProfile, getGetMerchantProfileQueryKey,
  useSaveMerchantProfile, useGetMerchantOverview, getGetMerchantOverviewQueryKey,
  useListMerchantOrders, getListMerchantOrdersQueryKey, useCreatePaymentLink,
  useUpdateShipping, useGetPublicOrder, getGetPublicOrderQueryKey, useSimulatePayment,
  useVerifyBuyerOtp, useConfirmOrderReceived, useSubmitDispute, useGetAdminOverview,
  getGetAdminOverviewQueryKey, useListAdminOrders, getListAdminOrdersQueryKey,
  useListAdminDisputes, getListAdminDisputesQueryKey, useDecideDispute,
  useMarkOrderDelivered, useRespondToDispute, getListMerchantDisputesQueryKey, useListMerchantDisputes,
} from '@workspace/api-client-react';
import type { Order, Dispute } from '@workspace/api-client-react';
import { DisputeInputReason, DisputeDecisionInputDecision } from '@workspace/api-client-react';
import {
  Activity, ArrowRight, Bell, Check, CheckCircle2, Clipboard, Clock3, ExternalLink, Eye, FileImage,
  Globe2, Headphones, Home as HomeIcon, ImagePlus, Link2, LockKeyhole, LogOut, Menu, Moon, Package,
  Plus, Send, Settings, Shield, ShieldCheck, Sun, Truck, WalletCards, X, AlertCircle,
} from 'lucide-react';
import { Route, Switch, Router as WouterRouter, Redirect, Link, useLocation, useParams } from 'wouter';

const queryClient = new QueryClient();
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }

type Lang = 'en' | 'ar';
const LocaleContext = createContext<{ lang: Lang; setLang: (v: Lang) => void; dark: boolean; setDark: (v: boolean) => void }>({
  lang: 'en', setLang: () => undefined, dark: true, setDark: () => undefined,
});
const useLocale = () => useContext(LocaleContext);
const words: Record<string, [string, string]> = {
  dashboard: ['Overview', 'نظرة عامة'], orders: ['Orders', 'الطلبات'], create: ['Create link', 'إنشاء رابط'],
  disputes: ['Disputes', 'النزاعات'], settings: ['Settings', 'الإعدادات'], hello: ['Good morning', 'صباح الخير'],
  links: ['Create a payment link', 'أنشئ رابط دفع'], logout: ['Sign out', 'تسجيل الخروج'], welcome: ['Protection, built into every sale.', 'حماية مدمجة في كل عملية بيع.'],
};
function t(key: string, lang: Lang) { return words[key]?.[lang === 'ar' ? 1 : 0] ?? key; }
const arabicCopy: Record<string, string> = {
  'Switch language': 'تغيير اللغة', 'Toggle theme': 'تغيير المظهر', 'Sign in': 'تسجيل الدخول', 'Sign out': 'تسجيل الخروج',
  'Create account': 'إنشاء حساب', 'Start selling with GARANT': 'ابدأ البيع مع GARANT', 'Merchant sign in': 'دخول التاجر',
  'Built for Kuwait’s social sellers': 'مصمم للبائعين عبر التواصل الاجتماعي في الكويت', "Built for Kuwait's social sellers": 'مصمم للبائعين عبر التواصل الاجتماعي في الكويت',
  'Share one trusted payment link on Instagram or WhatsApp. Buyers pay and follow delivery without creating an account.': 'أرسل رابط دفع موثوقاً عبر إنستغرام أو واتساب. يدفع المشترون ويتابعون التوصيل دون إنشاء حساب.',
  'Built for Kuwait. Demo payment simulation only.': 'مصمم للكويت. محاكاة الدفع للعرض فقط.',
  'For independent shops, studios & sellers': 'للمتاجر والاستوديوهات والبائعين المستقلين',
  'Protected sale': 'عملية بيع محمية', 'Order protection': 'حماية الطلب', 'The trusted middle': 'وسيط موثوق', 'Payment held securely': 'الدفع محفوظ بأمان', 'Until your buyer receives it': 'حتى يستلم المشتري طلبه',
  'Share one simple link': 'أرسل رابطاً واحداً بسيطاً', 'Drop it into your next Instagram story or WhatsApp chat.': 'أضفه إلى قصتك القادمة على إنستغرام أو محادثتك على واتساب.',
  'Pay with KNET or card': 'ادفع عبر كي نت أو البطاقة', 'A familiar, account-free checkout for your buyer.': 'تجربة دفع مألوفة للمشتري دون حساب.',
  'Release after delivery': 'يُفرج عن المبلغ بعد التوصيل', 'Funds stay protected while the order is on its way.': 'يبقى المبلغ محمياً أثناء وصول الطلب.',
  'Simple for both sides': 'سهولة للطرفين', 'From DM to doorstep.': 'من الرسالة إلى باب المنزل.', 'Clear at every step.': 'وضوح في كل خطوة.',
  'GARANT gives small sellers the confidence of a protected checkout, without adding a complicated storefront to the way they already sell.': 'يمنح GARANT البائعين المستقلين تجربة دفع محمية دون الحاجة إلى إنشاء متجر إلكتروني جديد.',
  'Seller creates a link': 'ينشئ البائع رابطاً', 'Set your item, delivery fee and expected arrival.': 'أضف المنتج ورسوم التوصيل والموعد المتوقع.',
  'Buyer pays directly': 'يدفع المشتري مباشرة', 'They complete a short checkout without signing up.': 'يكمل المشتري عملية دفع بسيطة دون تسجيل.',
  'Order arrives safely': 'يصل الطلب بأمان', 'Track shipping, confirm delivery or raise a concern.': 'تابع الشحنة وأكّد الاستلام أو أبلغ عن مشكلة.',
  'Open your seller account': 'أنشئ حساب البائع', 'Overview': 'نظرة عامة', 'Orders': 'الطلبات', 'Create link': 'إنشاء رابط',
  'Create a payment link': 'إنشاء رابط دفع', 'Disputes': 'النزاعات', 'Settings': 'الإعدادات', 'Good morning': 'صباح الخير',
  'Welcome back': 'مرحباً بعودتك', 'Workspace': 'مساحة العمل', 'Merchant workspace': 'مساحة التاجر', 'Protected checkout': 'دفع محمي',
  'Buyer funds are held until delivery is confirmed.': 'يُحفظ مبلغ المشتري حتى تأكيد الاستلام.',
  'Make a link': 'أنشئ رابطاً', 'Notifications': 'الإشعارات', "You're all caught up. New order and dispute updates will appear here.": 'لا توجد تحديثات حالياً. ستظهر هنا مستجدات الطلبات والنزاعات.',
  'Demo notifications': 'إشعارات تجريبية', 'Your shop, all in one place.': 'متجرك في مكان واحد.',
  'Your shop, in focus.': 'متجرك أمامك بوضوح.', 'A clear view of sales, orders and the moments that need you.': 'نظرة واضحة على المبيعات والطلبات وما يحتاج إلى اهتمامك.',
  'Total sales': 'إجمالي المبيعات', 'Across completed orders': 'للطلبات المكتملة', 'Total orders': 'إجمالي الطلبات',
  'Completed orders': 'الطلبات المكتملة', 'Funds released': 'تم تحرير المبالغ', 'Store / phone': 'المتجر / الهاتف',
  'All time': 'طوال الفترة', 'Pending payments': 'مدفوعات معلّقة', 'Awaiting a buyer': 'بانتظار المشتري',
  'Needs your attention': 'يتطلب انتباهك', 'Weekly sales': 'المبيعات الأسبوعية', 'A rolling seven-day view': 'ملخص آخر سبعة أيام',
  'A little more peace of mind': 'مزيد من راحة البال', 'Every link includes buyer protection.': 'كل رابط يشمل حماية للمشتري.',
  'No storefront needed. Just share the link wherever your customers find you.': 'لا حاجة لمتجر إلكتروني. أرسل الرابط حيثما يتواصل معك عملاؤك.',
  'Create a link': 'إنشاء رابط', 'Recent orders': 'أحدث الطلبات', 'Your latest activity': 'آخر نشاطاتك',
  'View orders': 'عرض الطلبات', 'Your first sale starts with a link': 'أول عملية بيع تبدأ برابط',
  'Create a protected payment link and share it with your next customer.': 'أنشئ رابط دفع محمياً وأرسله إلى عميلك القادم.',
  'Create payment link': 'إنشاء رابط دفع', 'Order': 'الطلب', 'Buyer': 'المشتري', 'Date': 'التاريخ', 'Amount': 'المبلغ', 'Status': 'الحالة',
  'Awaiting buyer': 'بانتظار المشتري', 'Fulfilment': 'تنفيذ الطلب', 'Follow each order from payment through delivery.': 'تابع كل طلب من الدفع حتى التوصيل.',
  'New payment link': 'رابط دفع جديد', 'Paid and ready to ship': 'تم الدفع وجاهز للشحن', 'Add tracking': 'إضافة بيانات التتبع',
  'Mark this order delivered': 'تحديد الطلب كمُسلّم', 'Mark delivered': 'تحديد كمُسلّم', 'Mark this order as delivered? This is a demo status update.': 'هل تريد تحديد الطلب كمُسلّم؟ هذا تحديث تجريبي للحالة.',
  'Order marked as delivered.': 'تم تحديد الطلب كمُسلّم.', 'No orders yet': 'لا توجد طلبات بعد',
  'Once you share a payment link, each order will appear here.': 'ستظهر الطلبات هنا بعد مشاركة رابط الدفع.',
  'Add shipping details': 'إضافة بيانات الشحن', 'Carrier': 'شركة الشحن', 'Tracking number': 'رقم التتبع',
  'Tracking URL': 'رابط التتبع', 'Save tracking': 'حفظ بيانات التتبع', 'Saving…': 'جارٍ الحفظ…',
  'Shipping details saved. The buyer can now track their order. Simulated WhatsApp/SMS notification queued.': 'تم حفظ بيانات الشحن. يمكن للمشتري تتبع طلبه الآن. تم تجهيز إشعار واتساب/رسالة تجريبية.',
  'We could not update shipping. Please try again.': 'تعذر تحديث بيانات الشحن. يرجى المحاولة مجدداً.',
  'A better checkout, in a link': 'دفع أسهل عبر رابط واحد', 'Your link is ready.': 'رابطك جاهز.',
  'Send this to your buyer in a DM or message.': 'أرسل هذا الرابط إلى المشتري في رسالة مباشرة أو محادثة.',
  'Add the details your buyer needs. You can share the protected link anywhere.': 'أضف التفاصيل التي يحتاجها المشتري ثم شارك الرابط المحمي.',
  'What are you selling?': 'ما المنتج الذي تبيعه؟', 'Share just enough detail for a confident purchase.': 'أضف التفاصيل اللازمة لشراء واثق.',
  'Product name': 'اسم المنتج', 'Description': 'الوصف', 'A few details that make it special…': 'أضف بعض التفاصيل المميزة…',
  'Price (KWD)': 'السعر (د.ك)', 'Delivery fee (KWD)': 'رسوم التوصيل (د.ك)', 'Expected delivery': 'موعد التوصيل المتوقع',
  'Note for buyer': 'ملاحظة للمشتري', 'Optional message': 'رسالة اختيارية', 'Product photo': 'صورة المنتج',
  'Optional': 'اختياري', 'Choose a product photo': 'اختر صورة للمنتج', 'Change photo': 'تغيير الصورة',
  'Preview stays here; upload is demo-ready.': 'ستظهر المعاينة هنا. رفع الصور تجريبي.',
  'Create protected link': 'إنشاء رابط محمي', 'Creating link…': 'جارٍ إنشاء الرابط…',
  'The payment link could not be created. Check the details and try again.': 'تعذر إنشاء رابط الدفع. تحقق من التفاصيل وحاول مجدداً.',
  'Protected payment link': 'رابط الدفع المحمي', 'Copy link': 'نسخ الرابط', 'Copied': 'تم النسخ',
  'Share via WhatsApp': 'المشاركة عبر واتساب', 'This is a payment simulation MVP. No real money will move.': 'هذه محاكاة للدفع فقط. لن يتم تحويل أموال حقيقية.',
  'Buyer preview': 'معاينة المشتري', 'A checkout that feels safe.': 'تجربة دفع مطمئنة.', 'No account needed. Pay by KNET or card, then track delivery on the same link.': 'لا حاجة إلى حساب. ادفع عبر كي نت أو البطاقة ثم تابع التوصيل من الرابط نفسه.',
  'Open buyer checkout': 'فتح صفحة دفع المشتري', 'Buyer-first protection': 'حماية تضع المشتري أولاً',
  'A clear total and simple tracking makes it easier to say yes.': 'الإجمالي الواضح والتتبع السهل يمنحان المشتري ثقة أكبر.',
  'KNET and card payment simulations': 'محاكاة الدفع عبر كي نت والبطاقة', 'No buyer account required': 'لا حاجة إلى حساب للمشتري',
  'Delivery confirmation and complaints': 'تأكيد الاستلام وتقديم الشكاوى',
  'Support, handled fairly': 'دعم عادل للطرفين', 'Share context with the review team and follow each buyer concern.': 'أرسل التفاصيل إلى فريق المراجعة وتابع ملاحظات المشتري.',
  'Your response was sent to the review team.': 'تم إرسال ردك إلى فريق المراجعة.',
  'Could not send your response. Please try again.': 'تعذر إرسال ردك. يرجى المحاولة مجدداً.',
  'Share relevant context with the review team…': 'أضف معلومات تساعد فريق المراجعة…', 'Send response': 'إرسال الرد',
  'Sending…': 'جارٍ الإرسال…', 'Buyer evidence': 'مرفقات المشتري', 'Your response': 'ردك',
  'No open disputes': 'لا توجد نزاعات مفتوحة', 'If a buyer reports an issue, the case and response history will appear here.': 'ستظهر هنا تفاصيل أي مشكلة يبلغ عنها المشتري وسجل الردود.',
  'Support is here if you need us': 'نحن هنا لمساعدتك',
  'Your details, your way': 'بياناتك، بطريقتك', 'Keep your store information current for buyers.': 'حدّث معلومات متجرك التي تظهر للمشترين.',
  'Merchant profile': 'ملف التاجر', 'This information appears on your payment links.': 'تظهر هذه المعلومات في روابط الدفع.',
  'Full name': 'الاسم الكامل', 'Store name': 'اسم المتجر', 'Email address': 'البريد الإلكتروني',
  'Phone number': 'رقم الهاتف', 'Save changes': 'حفظ التغييرات', 'Your profile has been saved.': 'تم حفظ ملفك الشخصي.',
  'Could not save your profile. Please try again.': 'تعذر حفظ ملفك الشخصي. يرجى المحاولة مجدداً.',
  'Protected by design': 'حماية مدمجة في التصميم', 'Payments shown in GARANT are simulations for this MVP. No actual funds are moved.': 'المدفوعات في GARANT تجريبية لهذا الإصدار. لا يتم تحويل أموال حقيقية.',
  'Signed in as': 'تم تسجيل الدخول باسم', 'Merchant account': 'حساب التاجر',
  'GARANT operations': 'إدارة GARANT', 'Admin overview': 'نظرة عامة للإدارة',
  'Monitor the service and review buyer protection cases.': 'تابع الخدمة وراجع حالات حماية المشترين.',
  'Merchants': 'التجار', 'Transaction volume': 'حجم المعاملات', 'Held payments': 'المدفوعات المحفوظة',
  'Completed': 'مكتمل', 'Open disputes': 'النزاعات المفتوحة', 'Dispute decisions': 'قرارات النزاعات',
  'Review evidence and decide a fair next step.': 'راجع الأدلة وحدد الإجراء العادل التالي.',
  'No disputes to review': 'لا توجد نزاعات للمراجعة', 'New buyer reports will appear here.': 'ستظهر هنا بلاغات المشترين الجديدة.',
  'Full refund (demo)': 'استرداد كامل (تجريبي)', 'Partial refund (demo)': 'استرداد جزئي (تجريبي)',
  'Release to seller (demo)': 'تحرير المبلغ للبائع (تجريبي)',
  'Decision saved. This demo does not move real money.': 'تم حفظ القرار. لا يتم تحويل أموال حقيقية في هذه المحاكاة.',
  'Could not save this decision. Please retry.': 'تعذر حفظ القرار. يرجى المحاولة مجدداً.',
  'Latest orders': 'أحدث الطلبات', 'No platform orders': 'لا توجد طلبات على المنصة',
  'Orders will appear as sellers begin using GARANT.': 'ستظهر الطلبات عند بدء استخدام البائعين لـ GARANT.',
  'Secure buyer checkout': 'دفع آمن للمشتري', 'Your delivery details': 'بيانات التوصيل الخاصة بك',
  'No account needed. Just tell us where to send it.': 'لا حاجة إلى حساب. أخبرنا فقط بمكان التوصيل.',
  'Kuwait phone number': 'رقم الهاتف في الكويت', 'Delivery address': 'عنوان التوصيل',
  'Choose payment': 'اختر طريقة الدفع', 'Card': 'بطاقة', 'Demo only: payment is simulated. No real money will be charged.': 'للعرض فقط: الدفع محاكاة ولن يتم خصم أموال حقيقية.',
  'Processing demo…': 'جارٍ تنفيذ المحاكاة…', 'Payment simulation did not complete. Check your details and try again.': 'لم تكتمل محاكاة الدفع. تحقق من بياناتك وحاول مجدداً.',
  'Your simulated payment is secured. The seller can now prepare your order.': 'تم تأكيد الدفع التجريبي. يمكن للبائع تجهيز طلبك الآن.',
  'Verify delivery confirmation': 'تأكيد استلام الطلب', 'This MVP simulates phone verification. No SMS is sent; use the demo code 123456.': 'يتضمن هذا الإصدار تحققاً تجريبياً من الهاتف. لن تصلك رسالة؛ استخدم الرمز 123456.',
  'One-time code': 'رمز لمرة واحدة', 'Verify and continue': 'تحقق ومتابعة', 'Verifying…': 'جارٍ التحقق…',
  'We could not verify that code. Please try again.': 'تعذر التحقق من الرمز. يرجى المحاولة مجدداً.',
  'Could not confirm delivery. Please retry.': 'تعذر تأكيد الاستلام. يرجى المحاولة مجدداً.',
  'Delivery confirmed. This order is now complete.': 'تم تأكيد الاستلام واكتمال الطلب.',
  'Your concern has been submitted. The simulated payment is frozen while it is reviewed.': 'تم إرسال بلاغك. سيبقى الدفع التجريبي مجمداً أثناء المراجعة.',
  'We could not submit the report. Please try again.': 'تعذر إرسال البلاغ. يرجى المحاولة مجدداً.',
  'Order complete': 'اكتمل الطلب', 'Your order journey': 'مراحل طلبك', 'Created': 'تم الإنشاء',
  'If you do not confirm within 48 hours after delivery, the simulated payment releases automatically.': 'إذا لم تؤكد الاستلام خلال ٤٨ ساعة من التوصيل، فسيتم تحرير المبلغ التجريبي تلقائياً.',
  'Your Payment Is Protected by Garant': 'مدفوعتك محمية من GARANT',
  'Choose an image file.': 'اختر ملف صورة.', 'Product photo must be under 4 MB.': 'يجب ألا يتجاوز حجم صورة المنتج ٤ ميغابايت.',
  'Payment is frozen while the dispute is reviewed.': 'تم تجميد المبلغ أثناء مراجعة النزاع.',
  'Paid & held': 'تم الدفع والمبلغ محفوظ', 'Shipped': 'تم الشحن', 'Delivered': 'تم التوصيل',
  'Your payment is held in this demo.': 'المبلغ محفوظ في هذه المحاكاة.',
  'Track shipment': 'تتبع الشحنة',
  'Received, All Good': 'استلمت الطلب، كل شيء جيد', 'There’s a Problem': 'أواجه مشكلة',
  'What went wrong?': 'ما المشكلة؟', 'Add photo evidence (up to 3 images)': 'أضف صوراً كدليل (حتى ٣ صور)',
  'Tell us what happened (at least 10 characters)': 'أخبرنا بما حدث (١٠ أحرف على الأقل)',
  'Submit concern': 'إرسال البلاغ', 'Order summary': 'ملخص الطلب', 'Item': 'المنتج',
  'Item price': 'سعر المنتج', 'Delivery': 'التوصيل', 'Total': 'الإجمالي',
  'Funds are held until you confirm your order arrived.': 'يظل المبلغ محفوظاً حتى تؤكد استلام طلبك.',
  'Sold by': 'البائع', 'GARANT protected': 'محمي عبر GARANT',
  'GARANT buyer protection · No account required · Payment simulation only': 'حماية المشتري من GARANT · لا حاجة إلى حساب · محاكاة الدفع فقط',
  'Payments are simulated for this MVP. GARANT does not move real money.': 'المدفوعات محاكاة لهذا الإصدار. لا يحوّل GARANT أموالاً حقيقية.',
  'We could not load this information.': 'تعذر تحميل هذه المعلومات.', 'Try again': 'حاول مجدداً',
  'This payment link could not be found. Ask the seller to send you a fresh link.': 'تعذر العثور على رابط الدفع. اطلب من البائع إرسال رابط جديد.',
  'Saving profile…': 'جارٍ حفظ الملف…', 'Continue to GARANT': 'المتابعة إلى GARANT',
  'One quick setup': 'إعداد سريع', 'Set up your seller profile.': 'أكمل ملف البائع.',
  'Add the details buyers will see on your protected payment links.': 'أضف المعلومات التي ستظهر للمشترين في روابط الدفع المحمية.',
  'Your shop or studio': 'متجرك أو استوديوك', 'Your account email is verified by GARANT sign-in.': 'تم التحقق من بريد حسابك عند تسجيل الدخول إلى GARANT.',
  'We could not save your seller profile. Please try again.': 'تعذر حفظ ملف البائع. يرجى المحاولة مجدداً.',
  'Admin': 'الإدارة', 'Case': 'الحالة',
  'CREATED': 'تم الإنشاء', 'PAID & HELD': 'تم الدفع والمبلغ محفوظ', 'SHIPPED': 'تم الشحن',
  'DELIVERED': 'تم التوصيل', 'COMPLETED': 'مكتمل', 'DISPUTED': 'قيد النزاع',
  'Payment held in this demo.': 'المبلغ محفوظ في هذه المحاكاة.',
  'Funds are released after delivery is confirmed.': 'يُفرج عن المبلغ بعد تأكيد الاستلام.',
  'Expected delivery date': 'موعد التوصيل المتوقع',
  'There are no orders to show yet.': 'لا توجد طلبات لعرضها حالياً.',
  'Payment link created successfully.': 'تم إنشاء رابط الدفع بنجاح.',
  'Order status': 'حالة الطلب', 'Go back': 'العودة', 'Back to orders': 'العودة إلى الطلبات',
  'Would you like to sign out?': 'هل تريد تسجيل الخروج؟', 'No messages yet.': 'لا توجد رسائل بعد.',
  'Try a product name or buyer name': 'ابحث باسم المنتج أو المشتري',
  'Search orders': 'البحث في الطلبات',
  'Full refund': 'استرداد كامل', 'Release payment to seller': 'تحرير المبلغ للبائع',
  'Enter the partial refund amount in KWD': 'أدخل مبلغ الاسترداد الجزئي بالدينار الكويتي',
  'Issue a full refund': 'إصدار استرداد كامل',
  'Damaged product': 'منتج تالف', 'damaged product': 'منتج تالف',
  'Wrong item': 'منتج غير صحيح', 'wrong item': 'منتج غير صحيح',
  'Not as described': 'لا يطابق الوصف', 'not as described': 'لا يطابق الوصف',
  'Not received': 'لم يتم الاستلام', 'not received': 'لم يتم الاستلام',
  'Shipment reference': 'مرجع الشحنة', 'e.g. Aramex': 'مثال: أرامكس',
  'Protected checkout is ready to share.': 'الدفع المحمي جاهز للمشاركة.',
  'View buyer order': 'عرض طلب المشتري',
  'The buyer can now track their order.': 'يمكن للمشتري تتبع طلبه الآن.',
  'No account required': 'لا حاجة إلى حساب', 'This order is complete.': 'اكتمل هذا الطلب.',
  'Under review': 'قيد المراجعة', 'Funds are protected while your order is on the way.': 'المبلغ محمي أثناء وصول طلبك.',
  'KNET': 'كي نت', 'CARD': 'بطاقة',
  'Open navigation': 'فتح القائمة', 'Close navigation': 'إغلاق القائمة',
  'Close navigation backdrop': 'إغلاق القائمة', 'Open notifications': 'فتح الإشعارات',
  'Your name': 'اسمك', 'Area, block, street, building…': 'المنطقة، القطعة، الشارع، المبنى…',
  'This is a demo decision only.': 'هذا قرار تجريبي فقط.',
  'Issue a partial refund': 'إصدار استرداد جزئي',
  'Sun': 'الأحد', 'Mon': 'الاثنين', 'Tue': 'الثلاثاء', 'Wed': 'الأربعاء',
  'Thu': 'الخميس', 'Fri': 'الجمعة', 'Sat': 'السبت',
  'SUN': 'الأحد', 'MON': 'الاثنين', 'TUE': 'الثلاثاء', 'WED': 'الأربعاء',
  'THU': 'الخميس', 'FRI': 'الجمعة', 'SAT': 'السبت',
  'Click to upload an image': 'اضغط لاختيار صورة', 'Product preview': 'معاينة المنتج',
  'e.g. Linen weekend tote': 'مثال: حقيبة كتان',
};
const textOriginals = new WeakMap<Text, string>();
const attributeOriginals = new WeakMap<Element, Map<string, string>>();
function applyArabicCopy(lang: Lang) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    const current = textNode.nodeValue || '';
    const original = textOriginals.get(textNode) ?? current;
    if (lang === 'en') {
      const translatedOriginal = arabicCopy[original.trim()];
      if (textOriginals.has(textNode) && current === translatedOriginal) textNode.nodeValue = original;
      else if (textOriginals.has(textNode) && current !== original) textOriginals.set(textNode, current);
      continue;
    }
    const priorTranslation = textOriginals.get(textNode);
    const isPriorTranslation = priorTranslation ? current === arabicCopy[priorTranslation.trim()] : false;
    const source = priorTranslation && (isPriorTranslation || current === priorTranslation) ? priorTranslation : current;
    const match = source.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!match) continue;
    const translated = arabicCopy[match[2]];
    if (translated) {
      textOriginals.set(textNode, source);
      const nextValue = `${match[1]}${translated}${match[3]}`;
      if (current !== nextValue) textNode.nodeValue = nextValue;
    }
  }
  document.querySelectorAll<HTMLElement>('[placeholder], [aria-label], [title], [alt]').forEach(element => {
    const originals = attributeOriginals.get(element) || new Map<string, string>();
    ['placeholder', 'aria-label', 'title', 'alt'].forEach(attribute => {
      const current = element.getAttribute(attribute);
      if (current === null) return;
      const prior = originals.get(attribute);
      const original = prior && (current === arabicCopy[prior] || current === prior) ? prior : current;
      if (lang === 'en') {
        if (originals.has(attribute) && current !== original) element.setAttribute(attribute, original);
        return;
      }
      const translated = arabicCopy[original];
      if (translated) {
        originals.set(attribute, original);
        if (current !== translated) element.setAttribute(attribute, translated);
      }
    });
    if (originals.size) attributeOriginals.set(element, originals);
  });
}
function LanguageToggle() {
  const { lang, setLang } = useLocale();
  return <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="rounded-xl border border-border px-2.5 py-2 text-xs font-semibold hover:bg-muted" aria-label="Switch language"><Globe2 className="mr-1 inline h-3.5 w-3.5" />{lang === 'en' ? 'عربي' : 'EN'}</button>;
}
function ThemeToggle() {
  const { dark, setDark } = useLocale();
  return <button onClick={() => setDark(!dark)} className="rounded-xl border border-border p-2 hover:bg-muted" aria-label="Toggle theme">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>;
}
const fmt = (n: number) => `${Number(n || 0).toFixed(3)} KWD`;
const date = (d?: string | null) => d ? new Intl.DateTimeFormat(document.documentElement.lang === 'ar' ? 'ar-KW' : 'en-KW', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—';
const field = 'w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15';
const button = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50';
function Primary({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button className={`${button} bg-primary text-primary-foreground hover:brightness-95`} {...props}>{children}</button>; }
function Soft({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button className={`${button} border border-border bg-card text-foreground hover:bg-muted`} {...props}>{children}</button>; }
function PageTitle({ eyebrow, title, sub, action }: { eyebrow?: string; title: string; sub?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div>{eyebrow && <p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-primary">{eyebrow}</p>}<h1 className="display-font text-3xl font-bold tracking-tight sm:text-[38px]">{title}</h1>{sub && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{sub}</p>}</div>{action}</div>;
}
function Notice({ children, kind = 'success' }: { children: ReactNode; kind?: 'success' | 'error' | 'info' }) {
  return <div className={`my-4 flex gap-2 rounded-xl border p-3 text-sm ${kind === 'error' ? 'border-destructive/30 bg-destructive/10 text-destructive' : kind === 'info' ? 'border-sky-300/50 bg-sky-50 text-sky-900 dark:bg-sky-950/30 dark:text-sky-200' : 'border-primary/20 bg-primary/10 text-primary'}`}><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{children}</div>;
}
function LoadingBlock() { return <div className="space-y-3" aria-label="Loading">{[1, 2, 3].map(x => <div key={x} className="h-16 animate-pulse rounded-2xl bg-muted" />)}</div>; }
function ErrorBlock({ retry, text = 'We could not load this information.' }: { retry?: () => void; text?: string }) { return <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center"><AlertCircle className="mx-auto mb-2 h-5 w-5 text-destructive" /><p className="text-sm">{text}</p>{retry && <button className="mt-3 text-sm font-semibold text-primary underline" onClick={retry}>Try again</button>}</div>; }
function Empty({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) { return <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><Package className="h-5 w-5" /></div><p className="font-semibold">{title}</p><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{detail}</p>{action && <div className="mt-5">{action}</div>}</div>; }
function StatusPill({ status }: { status: string }) {
  const { lang } = useLocale();
  const style = status === 'COMPLETED' ? 'bg-primary/10 text-primary' : status === 'DISPUTED' ? 'bg-destructive/10 text-destructive' : status === 'CREATED' ? 'bg-muted text-muted-foreground' : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200';
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ${style}`}>{lang === 'ar' ? arabicCopy[status] || status : status}</span>;
}
function Money({ children }: { children: ReactNode }) { return <span className="mono-font">{children}</span>; }
function Logo({ inverse = false }: { inverse?: boolean }) { return <Link href="/" className={`flex items-center gap-2.5 font-bold tracking-tight ${inverse ? 'text-sidebar-foreground' : 'text-foreground'}`}><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck className="h-5 w-5" /></span><span className="text-[19px]">GARANT<span className="ml-1 text-primary">.</span></span></Link>; }

function Layout({ children }: { children: ReactNode }) {
  const [path] = useLocation(); const { lang } = useLocale(); const { signOut } = useClerk(); const { user } = useUser();
  const profile = useGetMerchantProfile({ query: { queryKey: getGetMerchantProfileQueryKey() } });
  const [mobile, setMobile] = useState(false); const [noticeOpen, setNoticeOpen] = useState(false);
  const nav = [
    { href: '/dashboard', name: t('dashboard', lang), icon: HomeIcon }, { href: '/orders', name: t('orders', lang), icon: Package },
    { href: '/create-link', name: t('create', lang), icon: Link2 }, { href: '/disputes', name: t('disputes', lang), icon: Shield },
    { href: '/settings', name: t('settings', lang), icon: Settings },
    ...(profile.data?.role === 'admin' ? [{ href: '/admin', name: 'Admin', icon: ShieldCheck }] : []),
  ];
  return <div className="min-h-[100dvh] bg-background text-foreground">
    <aside className={`fixed inset-y-0 z-40 flex w-[250px] flex-col bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform md:translate-x-0 ${mobile ? 'translate-x-0' : lang === 'ar' ? 'translate-x-full' : '-translate-x-full'} ${lang === 'ar' ? 'right-0 md:right-0' : 'left-0'}`}>
      <div className="flex items-center justify-between px-2"><Logo inverse /><button className="md:hidden" onClick={() => setMobile(false)} aria-label="Close navigation"><X /></button></div>
      <div className="mt-9 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-sidebar-foreground/45">Workspace</div>
      <nav className="mt-3 space-y-1">{nav.map(item => { const Icon = item.icon; const active = path === item.href; return <Link key={item.href} href={item.href} onClick={() => setMobile(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${active ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`}><Icon className={`h-[17px] w-[17px] ${active ? 'text-sidebar-primary' : ''}`} />{item.name}{item.href === '/disputes' && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400" />}</Link>; })}</nav>
      <div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-4"><div className="mb-2 flex items-center gap-2 text-xs font-semibold"><LockKeyhole className="h-4 w-4 text-sidebar-primary" />Protected checkout</div><p className="text-xs leading-relaxed text-sidebar-foreground/55">Buyer funds are held until delivery is confirmed.</p><Link href="/create-link" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-sidebar-primary">Make a link <ArrowRight className="h-3 w-3" /></Link></div>
      <button onClick={() => signOut({ redirectUrl: basePath || '/' })} className="mt-4 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-sidebar-foreground/65 hover:bg-sidebar-accent"><LogOut className="h-4 w-4" />{t('logout', lang)}</button>
    </aside>
    <div className={`${lang === 'ar' ? 'md:mr-[250px]' : 'md:ml-[250px]'}`}>
      <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-border/80 bg-background/90 px-4 backdrop-blur-md sm:px-7">
        <div className="flex items-center gap-3"><button onClick={() => setMobile(true)} className="rounded-lg p-2 hover:bg-muted md:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button><div className="hidden text-xs text-muted-foreground sm:block">Merchant workspace <span className="mx-2">/</span><span className="text-foreground">{nav.find(n => n.href === path)?.name || 'GARANT'}</span></div><div className="sm:hidden"><Logo /></div></div>
        <div className="flex items-center gap-2"><button className="rounded-xl p-2.5 text-muted-foreground hover:bg-muted" onClick={() => setNoticeOpen(!noticeOpen)} aria-label="Notifications"><Bell className="h-[18px] w-[18px]" /><span className="absolute ml-3 mt-[-20px] h-2 w-2 rounded-full border-2 border-background bg-primary" /></button><LanguageToggle /><ThemeToggle /><div className="hidden h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground sm:flex">{user?.firstName?.slice(0, 1) || 'M'}</div></div>
        {noticeOpen && <div className="absolute right-5 top-[62px] z-50 w-[min(340px,calc(100vw-32px))] rounded-2xl border border-border bg-card p-4 shadow-xl"><div className="flex items-center justify-between"><strong className="text-sm">Notifications</strong><button onClick={() => setNoticeOpen(false)}><X className="h-4 w-4" /></button></div><p className="mt-3 rounded-xl bg-muted p-3 text-xs leading-relaxed">You're all caught up. New order and dispute updates will appear here.</p><span className="mt-2 block text-[10px] text-muted-foreground">Demo notifications</span></div>}
      </header>
      <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-7 lg:px-10">{children}</main>
    </div>
    {mobile && <button aria-label="Close navigation backdrop" onClick={() => setMobile(false)} className="fixed inset-0 z-30 bg-black/30 md:hidden" />}
  </div>;
}
function Protected({ children }: { children: ReactNode }) { return <><Show when="signed-in">{children}</Show><Show when="signed-out"><Redirect to="/" /></Show></>; }

function MerchantGate({ children }: { children: ReactNode }) {
  const profile = useGetMerchantProfile({ query: { queryKey: getGetMerchantProfileQueryKey() } });
  const save = useSaveMerchantProfile();
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const [error, setError] = useState('');
  if (profile.isLoading) return <div className="mx-auto max-w-xl px-4 py-10"><LoadingBlock /></div>;
  if (profile.isError) {
    function submit(e: FormEvent<HTMLFormElement>) {
      e.preventDefault();
      const form = new FormData(e.currentTarget);
      setError('');
      save.mutate({ data: { fullName: String(form.get('fullName')), storeName: String(form.get('storeName')), phoneNumber: String(form.get('phoneNumber')) } }, {
        onSuccess: () => {
          client.invalidateQueries({ queryKey: getGetMerchantProfileQueryKey() });
          setLocation('/dashboard');
        },
        onError: () => setError('We could not save your seller profile. Please try again.'),
      });
    }
    return <main className="min-h-[100dvh] bg-background px-4 py-10"><div className="mx-auto max-w-xl"><div className="mb-8"><Logo /><p className="mt-8 text-[10px] font-bold uppercase tracking-[.2em] text-primary">One quick setup</p><h1 className="display-font mt-2 text-3xl font-bold">Set up your seller profile.</h1><p className="mt-2 text-sm text-muted-foreground">Add the details buyers will see on your protected payment links.</p></div><form onSubmit={submit} className="space-y-4 rounded-3xl border border-border bg-card p-6 sm:p-8"><label className="block text-xs font-semibold">Full name<input name="fullName" required minLength={2} defaultValue={[user?.firstName, user?.lastName].filter(Boolean).join(' ')} className={`${field} mt-1.5`} /></label><label className="block text-xs font-semibold">Store name<input name="storeName" required minLength={2} className={`${field} mt-1.5`} placeholder="Your shop or studio" /></label><label className="block text-xs font-semibold">Phone number<input name="phoneNumber" required type="tel" minLength={5} className={`${field} mt-1.5`} placeholder="+965" /></label>{error && <Notice kind="error">{error}</Notice>}<Primary type="submit" disabled={save.isPending} className="w-full">{save.isPending ? 'Saving profile…' : 'Continue to GARANT'}<ArrowRight className="h-4 w-4" /></Primary><p className="text-center text-[10px] text-muted-foreground">Your account email is verified by GARANT sign-in.</p></form></div></main>;
  }
  return <>{children}</>;
}

function Home() {
  const { lang } = useLocale();
  return <main className="min-h-[100dvh] overflow-hidden bg-background"><header className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-5 sm:px-5 sm:py-6"><Logo /><div className="flex min-w-0 items-center gap-1 sm:gap-2"><LanguageToggle /><ThemeToggle /><Link href="/sign-in" className={`${button} mobile-header-link text-muted-foreground`}>Sign in</Link><Link href="/sign-up" className={`${button} mobile-header-link bg-primary text-primary-foreground`}>Create account <ArrowRight className="h-4 w-4" /></Link></div></header>
    <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-12 md:grid-cols-[1.02fr_.98fr] md:pb-28 md:pt-20">
      <div className="rise relative z-10"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary"><ShieldCheck className="h-4 w-4" /> Built for Kuwait's social sellers</div><h1 className="display-font max-w-[680px] text-[48px] font-extrabold leading-[1.05] tracking-[-.045em] sm:text-[68px]">{t('welcome', lang)}</h1><p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">Share one trusted payment link on Instagram or WhatsApp. Buyers pay and follow delivery without creating an account.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/sign-up" className={`${button} bg-primary px-5 py-3 text-primary-foreground`}>Start selling with GARANT <ArrowRight className="h-4 w-4" /></Link><Link href="/sign-in" className={`${button} border border-border bg-card px-5 py-3`}>Merchant sign in</Link></div><div className="mt-7 flex items-center gap-3 text-xs text-muted-foreground"><div className="flex -space-x-2"><span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-[#d6b2a0] text-[9px] font-bold text-[#3b2823]">S</span><span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-[#ddc981] text-[9px] font-bold text-[#453c20]">A</span><span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-[#92b8a0] text-[9px] font-bold text-[#1f3829]">M</span></div><span>For independent shops, studios & sellers</span></div></div>
      <div className="relative mx-auto w-full max-w-[550px] rise"><div className="absolute -right-8 -top-7 h-44 w-44 rounded-full bg-accent/60 blur-3xl" /><div className="relative overflow-hidden rounded-[30px] border border-border bg-[#e9e5d9] p-5 shadow-[0_30px_90px_-40px_rgba(25,41,37,.35)] sm:p-8"><div className="absolute right-5 top-5 rotate-6 rounded-xl bg-[#193c31] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#e5f1d8]">Protected sale</div><div className="flex h-[220px] items-center justify-center rounded-2xl bg-[#d4d0c4] sm:h-[280px]"><div className="relative flex h-[185px] w-[230px] rotate-[-5deg] items-center justify-center rounded-[24px] border border-white/70 bg-gradient-to-br from-[#c7b59b] via-[#ebe1cf] to-[#b4aa98] shadow-xl sm:h-[225px] sm:w-[300px]"><div className="absolute left-[-10px] top-8 h-12 w-12 rounded-full bg-[#f1e9d8]/80" /><div className="absolute right-[-10px] top-14 h-16 w-16 rounded-full bg-[#f1e9d8]/70" /><div className="absolute bottom-6 left-10 h-20 w-20 rounded-full bg-[#aebaa7]/90" /><div className="h-24 w-24 rotate-12 rounded-[26px] border border-white/80 bg-[#f5f0e7]/80 shadow-md sm:h-32 sm:w-32"><div className="mx-auto mt-6 h-12 w-12 rounded-full bg-[#e2d8c7] sm:mt-8 sm:h-16 sm:w-16" /></div><span className="absolute bottom-3 right-4 text-[9px] font-bold tracking-[.15em] text-[#596057]">STUDIO OBJECT Nº 04</span></div></div><div className="flex items-center justify-between px-1 pt-5"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#5c655b]">Order protection</p><h3 className="display-font mt-1 text-xl font-bold text-[#192923]">The trusted middle</h3></div><div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground"><ShieldCheck className="h-5 w-5" /></div></div></div><div className="absolute -bottom-6 -left-6 rounded-2xl border border-border bg-card p-4 shadow-lg sm:-left-10"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><LockKeyhole className="h-4 w-4" /></span><div><p className="text-xs font-bold">Payment held securely</p><p className="mt-1 text-[10px] text-muted-foreground">Until your buyer receives it</p></div><Check className="ml-4 h-4 w-4 text-primary" /></div></div></div>
    </section>
    <section className="border-y border-border bg-card/50"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-9 sm:grid-cols-3"><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Link2 className="h-5 w-5" /></span><div><b className="text-sm">Share one simple link</b><p className="mt-1 text-xs leading-5 text-muted-foreground">Drop it into your next Instagram story or WhatsApp chat.</p></div></div><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"><WalletCards className="h-5 w-5" /></span><div><b className="text-sm">Pay with KNET or card</b><p className="mt-1 text-xs leading-5 text-muted-foreground">A familiar, account-free checkout for your buyer.</p></div></div><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></span><div><b className="text-sm">Release after delivery</b><p className="mt-1 text-xs leading-5 text-muted-foreground">Funds stay protected while the order is on its way.</p></div></div></div></section>
    <section className="mx-auto grid max-w-7xl gap-10 px-5 py-20 md:grid-cols-2 md:py-28"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Simple for both sides</p><h2 className="display-font mt-4 text-4xl font-bold tracking-tight">From DM to doorstep.<br />Clear at every step.</h2><p className="mt-4 max-w-md leading-7 text-muted-foreground">GARANT gives small sellers the confidence of a protected checkout, without adding a complicated storefront to the way they already sell.</p></div><div className="space-y-3">{[['01', 'Seller creates a link', 'Set your item, delivery fee and expected arrival.'], ['02', 'Buyer pays directly', 'They complete a short checkout without signing up.'], ['03', 'Order arrives safely', 'Track shipping, confirm delivery or raise a concern.']].map(([n, title, copy]) => <div key={n} className="flex gap-4 rounded-2xl border border-border bg-card p-5"><span className="mono-font mt-0.5 text-xs font-semibold text-primary">{n}</span><div><b>{title}</b><p className="mt-1 text-sm text-muted-foreground">{copy}</p></div></div>)}</div></section>
    <footer className="border-t border-border"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-7"><Logo /><p className="text-xs text-muted-foreground">Built for Kuwait. Demo payment simulation only.</p><Link href="/sign-up" className="text-sm font-semibold text-primary">Open your seller account <ArrowRight className="ml-1 inline h-4 w-4" /></Link></div></footer>
  </main>;
}

function Dashboard() {
  const { lang } = useLocale(); const q = useGetMerchantOverview({ query: { queryKey: getGetMerchantOverviewQueryKey() } });
  const profile = useGetMerchantProfile({ query: { queryKey: getGetMerchantProfileQueryKey() } });
  if (q.isLoading) return <><PageTitle title={t('hello', lang)} sub="Your shop, all in one place." /><LoadingBlock /></>;
  if (q.isError) return <ErrorBlock retry={() => q.refetch()} />;
  const data = q.data; const stats = [
    { label: 'Total sales', value: fmt(data?.totalSales ?? 0), icon: WalletCards, change: 'Across completed orders' },
    { label: 'Total orders', value: data?.totalOrders ?? 0, icon: Package, change: 'All time' },
    { label: 'Pending payments', value: data?.pendingPayments ?? 0, icon: Clock3, change: 'Awaiting a buyer' },
    { label: 'Completed orders', value: data?.completedOrders ?? 0, icon: CheckCircle2, change: 'Funds released' },
    { label: 'Disputes', value: data?.disputedOrders ?? 0, icon: Shield, change: 'Needs your attention' },
  ];
  const max = Math.max(1, ...(data?.weeklySales || []).map(x => x.amount));
  return <div className="rise"><PageTitle eyebrow={`${lang === 'ar' ? 'مرحباً بعودتك' : 'Welcome back'}${profile.data?.fullName ? `${lang === 'ar' ? '، ' : ', '}${profile.data.fullName.split(' ')[0]}` : ''}`} title="Your shop, in focus." sub="A clear view of sales, orders and the moments that need you." action={<Link href="/create-link" className={`${button} bg-primary text-primary-foreground`}><Plus className="h-4 w-4" />{t('links', lang)}</Link>} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{stats.map(({ label, value, icon: Icon, change }) => <div key={label} className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><span className="rounded-xl bg-muted p-2 text-primary"><Icon className="h-4 w-4" /></span></div><p className="display-font mt-4 text-2xl font-bold"><Money>{value}</Money></p><p className="mt-1 text-[11px] text-muted-foreground">{change}</p></div>)}</div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.85fr]"><section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="text-sm font-bold">Weekly sales</p><p className="mt-1 text-xs text-muted-foreground">A rolling seven-day view</p></div><Activity className="h-4 w-4 text-muted-foreground" /></div><div className="mt-8 flex h-44 items-end gap-2 sm:gap-4">{(data?.weeklySales || []).map((point, i) => <div key={`${point.day}-${i}`} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-[9px] text-muted-foreground">{point.amount > 0 ? Math.round(point.amount) : ''}</span><div className={`w-full rounded-t-lg transition-all ${i === (data?.weeklySales.length || 0) - 1 ? 'bg-primary' : 'bg-primary/25'}`} style={{ height: `${Math.max(5, point.amount / max * 100)}%` }} /><span className="text-[10px] text-muted-foreground">{point.day}</span></div>)}</div></section><section className="relative overflow-hidden rounded-2xl bg-[#080D24] p-6 text-[#F3F4FF]"><div className="absolute -right-10 -top-12 h-44 w-44 rounded-full border border-white/10" /><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#A855F7]">A little more peace of mind</p><h3 className="display-font mt-4 max-w-[250px] text-2xl font-bold">Every link includes buyer protection.</h3><p className="mt-3 max-w-xs text-xs leading-5 text-white/65">No storefront needed. Just share the link wherever your customers find you.</p><Link href="/create-link" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#A855F7] px-4 py-2.5 text-xs font-bold text-[#080D24]">Create a link <ArrowRight className="h-3.5 w-3.5" /></Link><ShieldCheck className="absolute bottom-5 right-5 h-9 w-9 text-white/20" /></section></div>
    <section className="mt-5 rounded-2xl border border-border bg-card"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h3 className="text-sm font-bold">Recent orders</h3><p className="mt-1 text-xs text-muted-foreground">Your latest activity</p></div><Link href="/orders" className="text-xs font-semibold text-primary">View orders <ArrowRight className="ml-1 inline h-3 w-3" /></Link></div>{data?.recentOrders?.length ? <OrderTable orders={data.recentOrders.slice(0, 5)} /> : <div className="p-5"><Empty title="Your first sale starts with a link" detail="Create a protected payment link and share it with your next customer." action={<Link href="/create-link" className={`${button} bg-primary text-primary-foreground`}>Create payment link</Link>} /></div>}</section>
  </div>;
}
function OrderTable({ orders, showMerchantDetails = false }: { orders: Order[]; showMerchantDetails?: boolean }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-5 py-3 font-semibold">Order</th><th className="px-5 py-3 font-semibold">Buyer</th>{showMerchantDetails && <th className="px-5 py-3 font-semibold">Store / phone</th>}<th className="px-5 py-3 font-semibold">Date</th><th className="px-5 py-3 font-semibold">Amount</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3" /></tr></thead><tbody>{orders.map(o => <tr key={o.id} className="border-t border-border/70"><td className="px-5 py-3.5"><p className="font-semibold">{o.productName}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">#{o.id}</p></td><td className="px-5 py-3.5">{o.buyerName || 'Awaiting buyer'}</td>{showMerchantDetails && <td className="px-5 py-3.5"><p>{o.storeName}</p><p className="mt-1 text-xs text-muted-foreground">{o.merchantPhone}</p></td>}<td className="px-5 py-3.5 text-muted-foreground">{date(o.createdAt)}</td><td className="px-5 py-3.5 font-medium"><Money>{fmt(o.totalAmount)}</Money></td><td className="px-5 py-3.5"><StatusPill status={o.status} /></td><td className="px-5 py-3.5"><Link href={`/pay/${o.token}`} className="text-primary" aria-label={`Open ${o.productName}`}><ExternalLink className="h-4 w-4" /></Link></td></tr>)}</tbody></table></div>;
}

function Orders() {
  const { lang } = useLocale();
  const query = useListMerchantOrders({ query: { queryKey: getListMerchantOrdersQueryKey() } }); const client = useQueryClient(); const update = useUpdateShipping(); const markDelivered = useMarkOrderDelivered();
  const [selected, setSelected] = useState<Order | null>(null); const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  async function saveShipping(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); const f = new FormData(e.currentTarget); if (!selected) return;
    update.mutate({ orderId: selected.id, data: { carrier: String(f.get('carrier')), trackingNumber: String(f.get('trackingNumber')), trackingUrl: String(f.get('trackingUrl')) } }, {
      onSuccess: () => { client.invalidateQueries({ queryKey: getListMerchantOrdersQueryKey() }); setSelected(null); setNotice('Shipping details saved. The buyer can now track their order. Simulated WhatsApp/SMS notification queued.'); },
      onError: () => setError('We could not update shipping. Please try again.'),
    });
  }
  return <><PageTitle eyebrow="Fulfilment" title="Orders" sub="Follow each order from payment through delivery." action={<Link href="/create-link" className={`${button} bg-primary text-primary-foreground`}><Plus className="h-4 w-4" />New payment link</Link>} />{notice && <Notice>{notice}</Notice>}{error && <Notice kind="error">{error}</Notice>}{query.isLoading ? <LoadingBlock /> : query.isError ? <ErrorBlock retry={() => query.refetch()} /> : query.data?.length ? <div className="overflow-hidden rounded-2xl border border-border bg-card"><OrderTable orders={query.data} /><div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2">{query.data.filter(o => o.status === 'PAID & HELD').map(o => <div key={o.id} className="flex items-center justify-between rounded-xl bg-muted/70 p-3"><div><p className="text-sm font-semibold">{o.productName}</p><p className="text-xs text-muted-foreground">Paid and ready to ship</p></div><Soft onClick={() => setSelected(o)}><Truck className="h-4 w-4" />Add tracking</Soft></div>)}{query.data.filter(o => o.status === 'SHIPPED').map(o => <div key={`delivered-${o.id}`} className="flex items-center justify-between rounded-xl bg-primary/5 p-3"><div><p className="text-sm font-semibold">{o.productName}</p><p className="text-xs text-muted-foreground">Mark this order delivered</p></div><Soft disabled={markDelivered.isPending} onClick={() => { if (!window.confirm(lang === 'ar' ? 'هل تريد تحديد الطلب كمُسلّم؟ هذا تحديث تجريبي للحالة.' : 'Mark this order as delivered? This is a demo status update.')) return; markDelivered.mutate({ orderId: o.id }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListMerchantOrdersQueryKey() }); client.invalidateQueries({ queryKey: getGetMerchantOverviewQueryKey() }); setNotice('Order marked as delivered.'); }, onError: () => setError('Could not update delivery status.') }); }}><CheckCircle2 className="h-4 w-4" />Mark delivered</Soft></div>)}</div></div> : <Empty title="No orders yet" detail="Once you share a payment link, each order will appear here." action={<Link href="/create-link" className={`${button} bg-primary text-primary-foreground`}>Create your first link</Link>} />}
    {selected && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/40 p-4" role="dialog" aria-modal="true"><form onSubmit={saveShipping} className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs text-primary">Order #{selected.id}</p><h2 className="display-font text-xl font-bold">Add shipping details</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Close"><X /></button></div><label className="mb-4 block text-xs font-semibold">Carrier<input name="carrier" required className={`${field} mt-1.5`} placeholder="e.g. Aramex" /></label><label className="mb-4 block text-xs font-semibold">Tracking number<input name="trackingNumber" required className={`${field} mt-1.5`} placeholder="Shipment reference" /></label><label className="mb-5 block text-xs font-semibold">Tracking URL<input name="trackingUrl" type="url" required className={`${field} mt-1.5`} placeholder="https://" /></label>{error && <p className="mb-3 text-xs text-destructive">{error}</p>}<Primary type="submit" disabled={update.isPending} className="w-full">{update.isPending ? 'Saving…' : 'Save tracking'}</Primary></form></div>}
  </>;
}

function CreateLink() {
  const { lang } = useLocale();
  const create = useCreatePaymentLink(); const client = useQueryClient(); const [image, setImage] = useState(''); const [result, setResult] = useState<Order | null>(null); const [error, setError] = useState(''); const [copied, setCopied] = useState(false);
  function onImage(file?: File) { if (!file) return; if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return; } if (file.size > 4_000_000) { setError('Product photo must be under 4 MB.'); return; } setError(''); const reader = new FileReader(); reader.onload = () => setImage(String(reader.result)); reader.readAsDataURL(file); }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); setError('');
    create.mutate({ data: { productName: String(f.get('productName')), description: String(f.get('description')), imageUrl: image || null, productPrice: Number(f.get('price')), deliveryFee: Number(f.get('delivery')), expectedDeliveryDate: String(f.get('date')), notes: String(f.get('notes') || '') || null } }, {
      onSuccess: order => { setResult(order); client.invalidateQueries({ queryKey: getListMerchantOrdersQueryKey() }); client.invalidateQueries({ queryKey: getGetMerchantOverviewQueryKey() }); navigator.clipboard?.writeText(`${window.location.origin}/pay/${order.token}`).catch(() => undefined); },
      onError: () => setError('The payment link could not be created. Check the details and try again.'),
    });
  }
  const href = result ? `${window.location.origin}/pay/${result.token}` : '';
  return <><PageTitle eyebrow="A better checkout, in a link" title={result ? 'Your link is ready.' : t('links', lang)} sub={result ? 'Send this to your buyer in a DM or message.' : 'Add the details your buyer needs. You can share the protected link anywhere.'} />
    {result ? <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]"><section className="rounded-3xl border border-border bg-card p-6 sm:p-8"><div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><CheckCircle2 /></div><h2 className="display-font text-2xl font-bold">{result.productName}</h2><p className="mt-2 text-sm text-muted-foreground">{result.description || 'Protected checkout is ready to share.'}</p><div className="mt-7 rounded-2xl border border-border bg-background p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Protected payment link</p><p className="mt-2 break-all font-mono text-xs text-primary">{href}</p></div><div className="mt-4 flex flex-wrap gap-2"><Primary onClick={async () => { await navigator.clipboard?.writeText(href); setCopied(true); }}><Clipboard className="h-4 w-4" />{copied ? 'Copied' : 'Copy link'}</Primary><a href={`https://wa.me/?text=${encodeURIComponent(`Protected checkout for ${result.productName}: ${href}`)}`} target="_blank" rel="noreferrer" className={`${button} border border-border bg-card`}><Send className="h-4 w-4" />Share via WhatsApp</a><Link href="/orders" className={`${button} border border-border bg-card`}>View orders</Link></div><Notice kind="info">This is a payment simulation MVP. No real money will move.</Notice></section><div className="rounded-3xl bg-[#080D24] p-6 text-white"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#A855F7]">Buyer preview</p><h3 className="display-font mt-4 text-2xl font-bold">A checkout that feels safe.</h3><p className="mt-2 text-sm text-white/65">No account needed. Pay by KNET or card, then track delivery on the same link.</p><div className="mt-6 flex items-center justify-between border-t border-white/15 pt-4 text-sm"><span>{result.productName}</span><strong>{fmt(result.totalAmount)}</strong></div><Link href={`/pay/${result.token}`} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#A855F7] px-4 py-3 text-sm font-bold text-[#080D24]">Open buyer checkout <ExternalLink className="h-4 w-4" /></Link></div></div>
      : <div className="grid gap-6 lg:grid-cols-[1fr_330px]"><form onSubmit={submit} className="rounded-3xl border border-border bg-card p-5 sm:p-8"><div className="mb-6 flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Package className="h-5 w-5" /></span><div><h2 className="font-bold">What are you selling?</h2><p className="mt-1 text-xs text-muted-foreground">Share just enough detail for a confident purchase.</p></div></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold sm:col-span-2">Product name<input name="productName" required maxLength={120} className={`${field} mt-1.5`} placeholder="e.g. Linen weekend tote" /></label><label className="text-xs font-semibold sm:col-span-2">Description<textarea name="description" rows={3} className={`${field} mt-1.5 resize-y`} placeholder="A few details that make it special…" /></label>
        <label className="text-xs font-semibold">Price (KWD)<input name="price" type="number" min="0.001" step="0.001" required className={`${field} mt-1.5`} placeholder="24.500" /></label><label className="text-xs font-semibold">Delivery fee (KWD)<input name="delivery" type="number" min="0" step="0.001" required defaultValue="0" className={`${field} mt-1.5`} /></label>
        <label className="text-xs font-semibold">Expected delivery<input name="date" type="date" required className={`${field} mt-1.5`} /></label><label className="text-xs font-semibold">Note for buyer<input name="notes" className={`${field} mt-1.5`} placeholder="Optional message" /></label>
        <div className="sm:col-span-2"><span className="text-xs font-semibold">Product photo <span className="font-normal text-muted-foreground">Optional</span></span><label className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-background p-3 hover:border-primary">{image ? <img src={image} alt="Product preview" className="h-16 w-16 rounded-lg object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-muted-foreground"><ImagePlus className="h-5 w-5" /></span>}<span><b className="block text-xs">{image ? 'Change photo' : 'Choose a product photo'}</b><small className="mt-1 block text-[10px] text-muted-foreground">Preview stays here; upload is demo-ready.</small></span><input type="file" accept="image/*" className="sr-only" onChange={e => onImage(e.target.files?.[0])} /></label></div></div>
        {error && <Notice kind="error">{error}</Notice>}<div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5"><p className="max-w-xs text-[11px] leading-5 text-muted-foreground"><LockKeyhole className="mr-1 inline h-3.5 w-3.5 text-primary" />Buyer funds are held until delivery is confirmed.</p><Primary type="submit" disabled={create.isPending}>{create.isPending ? 'Creating link…' : 'Create protected link'}<ArrowRight className="h-4 w-4" /></Primary></div></form>
        <aside className="h-fit rounded-3xl bg-[#203d34] p-6 text-white"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><ShieldCheck className="h-5 w-5 text-[#9ac9a7]" /></div><h3 className="display-font mt-5 text-xl font-bold">Buyer-first protection</h3><p className="mt-2 text-xs leading-5 text-white/65">A clear total and simple tracking makes it easier to say yes.</p><div className="my-5 border-t border-white/15" /><div className="space-y-3 text-xs text-white/80"><p className="flex gap-2"><Check className="h-4 w-4 text-[#9ac9a7]" />KNET and card payment simulations</p><p className="flex gap-2"><Check className="h-4 w-4 text-[#9ac9a7]" />No buyer account required</p><p className="flex gap-2"><Check className="h-4 w-4 text-[#9ac9a7]" />Delivery confirmation and complaints</p></div></aside></div>}
  </>;
}

function Disputes() {
  const disputes = useListMerchantDisputes({ query: { queryKey: getListMerchantDisputesQueryKey() } });
  const respond = useRespondToDispute(); const client = useQueryClient(); const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  function sendResponse(e: FormEvent<HTMLFormElement>, d: Dispute) { e.preventDefault(); const f = new FormData(e.currentTarget); respond.mutate({ disputeId: d.id, data: { response: String(f.get('response')) } }, { onSuccess: () => { setNotice('Your response was sent to the review team.'); setError(''); client.invalidateQueries({ queryKey: getListMerchantDisputesQueryKey() }); }, onError: () => setError('Could not send your response. Please try again.') }); }
  return <><PageTitle eyebrow="Support, handled fairly" title="Disputes" sub="Share context with the review team and follow each buyer concern." />{notice && <Notice>{notice}</Notice>}{error && <Notice kind="error">{error}</Notice>}{disputes.isLoading ? <LoadingBlock /> : disputes.isError ? <ErrorBlock retry={() => disputes.refetch()} /> : disputes.data?.length ? <div className="space-y-3">{disputes.data.map(d => <div key={d.id} className="rounded-2xl border border-border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">Case #{d.id} · {date(d.createdAt)}</p><h3 className="mt-1 font-semibold">{d.productName}</h3><p className="mt-1 text-xs text-muted-foreground">Buyer: {d.buyerName || 'Buyer'} · {d.reason.replaceAll('_', ' ').toLowerCase()}</p></div><StatusPill status={d.status} /></div><p className="mt-4 text-sm leading-6 text-muted-foreground">{d.description}</p>{d.evidenceUrls?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{d.evidenceUrls.map((url, i) => <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-2 text-xs text-primary"><Eye className="h-3.5 w-3.5" />Buyer evidence {i + 1}</a>)}</div>}{d.merchantResponse ? <div className="mt-4 rounded-xl bg-primary/5 p-3 text-sm"><b className="text-xs text-primary">Your response</b><p className="mt-1 text-muted-foreground">{d.merchantResponse}</p></div> : <form onSubmit={e => sendResponse(e, d)} className="mt-4 flex flex-col gap-2 sm:flex-row"><textarea name="response" required minLength={5} rows={2} className={`${field} resize-y`} placeholder="Share relevant context with the review team…" /><Primary type="submit" disabled={respond.isPending} className="shrink-0 self-end">{respond.isPending ? 'Sending…' : 'Send response'}<Send className="h-4 w-4" /></Primary></form>}</div>)}</div> : <Empty title="No open disputes" detail="If a buyer reports an issue, the case and response history will appear here." action={<div className="inline-flex items-center gap-2 text-xs text-muted-foreground"><Headphones className="h-4 w-4" />Support is here if you need us</div>} />}</>;
}

function SettingsPage() {
  const profile = useGetMerchantProfile({ query: { queryKey: getGetMerchantProfileQueryKey() } }); const save = useSaveMerchantProfile(); const client = useQueryClient();
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  if (profile.isLoading) return <><PageTitle title="Settings" /><LoadingBlock /></>;
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); setMsg(''); setErr(''); save.mutate({ data: { fullName: String(f.get('fullName')), storeName: String(f.get('storeName')), phoneNumber: String(f.get('phoneNumber')) } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getGetMerchantProfileQueryKey() }); setMsg('Your profile has been saved.'); }, onError: () => setErr('Could not save your profile. Please try again.') }); }
  return <><PageTitle eyebrow="Your details, your way" title="Settings" sub="Keep your store information current for buyers." /><div className="grid gap-5 lg:grid-cols-[1fr_300px]"><form onSubmit={submit} className="rounded-3xl border border-border bg-card p-6 sm:p-8"><div className="mb-6 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Settings className="h-5 w-5" /></span><div><h2 className="font-bold">Merchant profile</h2><p className="text-xs text-muted-foreground">This information appears on your payment links.</p></div></div><label className="mb-4 block text-xs font-semibold">Full name<input required name="fullName" defaultValue={profile.data?.fullName || ''} className={`${field} mt-1.5`} /></label><label className="mb-4 block text-xs font-semibold">Store name<input required name="storeName" defaultValue={profile.data?.storeName || ''} className={`${field} mt-1.5`} /></label><label className="mb-4 block text-xs font-semibold">Email address<input readOnly name="email" value={profile.data?.email || ''} className={`${field} mt-1.5 opacity-70`} /></label><label className="mb-6 block text-xs font-semibold">Phone number<input required name="phoneNumber" defaultValue={profile.data?.phoneNumber || ''} className={`${field} mt-1.5`} placeholder="+965" /></label>{msg && <Notice>{msg}</Notice>}{err && <Notice kind="error">{err}</Notice>}<Primary type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save changes'}</Primary></form><aside className="h-fit rounded-3xl border border-border bg-card p-6"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></span><h3 className="mt-4 font-bold">Protected by design</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">Payments shown in GARANT are simulations for this MVP. No actual funds are moved.</p><div className="mt-5 rounded-xl bg-muted p-3 text-xs"><b className="block">Signed in as</b><span className="mt-1 block text-muted-foreground">{profile.data?.email || 'Merchant account'}</span></div></aside></div></>;
}

function Admin() {
  const { lang } = useLocale();
  const overview = useGetAdminOverview({ query: { queryKey: getGetAdminOverviewQueryKey() } });
  const disputes = useListAdminDisputes({ query: { queryKey: getListAdminDisputesQueryKey() } });
  const orders = useListAdminOrders({ query: { queryKey: getListAdminOrdersQueryKey() } });
  const decide = useDecideDispute(); const client = useQueryClient(); const [notice, setNotice] = useState(''); const [err, setErr] = useState('');
  function decision(d: Dispute, kind: 'FULL_REFUND' | 'PARTIAL_REFUND' | 'RELEASE_TO_MERCHANT') {
    const refundAmount = kind === 'PARTIAL_REFUND' ? Number(window.prompt(lang === 'ar' ? 'أدخل مبلغ الاسترداد الجزئي بالدينار الكويتي' : 'Enter the partial refund amount in KWD')) : undefined;
    if (kind === 'PARTIAL_REFUND' && (!refundAmount || refundAmount <= 0)) return;
    const title = kind === 'FULL_REFUND' ? 'Issue a full refund' : kind === 'PARTIAL_REFUND' ? `Issue a partial refund of ${fmt(refundAmount || 0)}` : 'Release payment to seller';
    const promptText = lang === 'ar' ? `${kind === 'FULL_REFUND' ? 'إصدار استرداد كامل' : kind === 'PARTIAL_REFUND' ? 'إصدار استرداد جزئي' : 'تحرير المبلغ للبائع'} للطلب ${d.productName}؟ هذا قرار تجريبي فقط.` : `${title} for ${d.productName}? This is a demo decision only.`;
    if (!window.confirm(promptText)) return;
    decide.mutate({ disputeId: d.id, data: { decision: kind === 'FULL_REFUND' ? DisputeDecisionInputDecision.FULL_REFUND : kind === 'PARTIAL_REFUND' ? DisputeDecisionInputDecision.PARTIAL_REFUND : DisputeDecisionInputDecision.RELEASE_TO_MERCHANT, refundAmount, adminNote: 'Reviewed in GARANT admin demo.' } }, { onSuccess: () => { setNotice('Decision saved. This demo does not move real money.'); client.invalidateQueries({ queryKey: getListAdminDisputesQueryKey() }); client.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }); }, onError: () => setErr('Could not save this decision. Please retry.') });
  }
  return <><PageTitle eyebrow="GARANT operations" title="Admin overview" sub="Monitor the service and review buyer protection cases." />{notice && <Notice>{notice}</Notice>}{err && <Notice kind="error">{err}</Notice>}{overview.isLoading ? <LoadingBlock /> : overview.isError ? <ErrorBlock retry={() => overview.refetch()} /> : <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[['Merchants', overview.data?.totalMerchants], ['Orders', overview.data?.totalOrders], ['Transaction volume', fmt(overview.data?.transactionVolume || 0)], ['Held payments', fmt(overview.data?.heldPayments || 0)], ['Completed', overview.data?.completedOrders], ['Open disputes', overview.data?.openDisputes]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-border bg-card p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="display-font mt-3 text-2xl font-bold">{value}</p></div>)}</div>}
    <section className="mb-6 rounded-2xl border border-border bg-card"><div className="border-b border-border p-5"><h2 className="font-bold">Dispute decisions</h2><p className="mt-1 text-xs text-muted-foreground">Review evidence and decide a fair next step.</p></div>{disputes.isLoading ? <div className="p-5"><LoadingBlock /></div> : disputes.isError ? <div className="p-5"><ErrorBlock retry={() => disputes.refetch()} /></div> : !disputes.data?.length ? <div className="p-5"><Empty title="No disputes to review" detail="New buyer reports will appear here." /></div> : <div className="divide-y divide-border">{disputes.data.map(d => <div key={d.id} className="p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-muted-foreground">Case #{d.id} · {date(d.createdAt)}</p><h3 className="mt-1 font-semibold">{d.productName}</h3><p className="mt-1 text-xs text-muted-foreground">{d.buyerName || 'Buyer'} · {d.reason.replaceAll('_', ' ').toLowerCase()}</p></div><StatusPill status={d.status} /></div><p className="mt-3 max-w-3xl text-sm text-muted-foreground">{d.description}</p>{d.evidenceUrls?.length ? <div className="mt-3 flex gap-2">{d.evidenceUrls.map((url, i) => <a key={url} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-2 text-xs text-primary"><Eye className="h-3.5 w-3.5" />Evidence {i + 1}</a>)}</div> : null}<div className="mt-4 flex flex-wrap gap-2"><Soft onClick={() => decision(d, 'FULL_REFUND')} disabled={decide.isPending}>Full refund (demo)</Soft><Soft onClick={() => decision(d, 'PARTIAL_REFUND')} disabled={decide.isPending}>Partial refund (demo)</Soft><Primary onClick={() => decision(d, 'RELEASE_TO_MERCHANT')} disabled={decide.isPending}>Release to seller (demo)</Primary></div></div>)}</div>}</section>
    <section className="rounded-2xl border border-border bg-card"><div className="border-b border-border p-5"><h2 className="font-bold">Latest orders</h2></div>{orders.isLoading ? <div className="p-5"><LoadingBlock /></div> : orders.isError ? <div className="p-5"><ErrorBlock retry={() => orders.refetch()} /></div> : orders.data?.length ? <OrderTable orders={orders.data.slice(0, 8)} showMerchantDetails /> : <div className="p-5"><Empty title="No platform orders" detail="Orders will appear as sellers begin using GARANT." /></div>}</section>
  </>;
}

function BuyerOrder() {
  const { token = '' } = useParams<{ token: string }>();
  const query = useGetPublicOrder(token, { query: { queryKey: getGetPublicOrderQueryKey(token), enabled: !!token } });
  const pay = useSimulatePayment(); const verify = useVerifyBuyerOtp(); const confirm = useConfirmOrderReceived(); const submitDispute = useSubmitDispute(); const client = useQueryClient();
  const [mode, setMode] = useState<'checkout' | 'otp' | 'complaint' | 'done'>('checkout'); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [nextAction, setNextAction] = useState<'confirm' | 'complaint'>('confirm');
  const [evidence, setEvidence] = useState<string[]>([]);
  function refresh() { client.invalidateQueries({ queryKey: getGetPublicOrderQueryKey(token) }); }
  function checkout(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); setError(''); pay.mutate({ token, data: { fullName: String(f.get('name')), phoneNumber: String(f.get('phone')), deliveryAddress: String(f.get('address')), paymentMethod: String(f.get('payment')) as 'KNET' | 'CARD' } }, { onSuccess: () => { setMode('done'); setMessage('Your simulated payment is secured. The seller can now prepare your order.'); refresh(); }, onError: () => setError('Payment simulation did not complete. Check your details and try again.') }); }
  function startOtp(action: 'confirm' | 'complaint') { setNextAction(action); setMode('otp'); setError(''); }
  function otp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const code = String(f.get('code'));
    setError('');
    verify.mutate({ token, data: { code } }, {
      onSuccess: r => {
        if (!r.success) { setError(r.message); return; }
        if (nextAction === 'confirm') {
          confirm.mutate({ token, data: { code } }, {
            onSuccess: () => { setMode('done'); setMessage('Delivery confirmed. This order is now complete.'); refresh(); },
            onError: () => setError('Could not confirm delivery. Please retry.'),
          });
        } else {
          setMode('complaint');
          setMessage('Your phone was verified. You can now send the complaint details.');
        }
      },
      onError: () => setError('We could not verify that code. Please try again.'),
    });
  }
  function confirmReceived() { startOtp('confirm'); }
  function reportProblem() { startOtp('complaint'); }
  function addEvidence(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file for evidence.'); return; }
    if (file.size > 1_500_000) { setError('Each evidence image must be under 1.5 MB.'); return; }
    if (evidence.length >= 3) { setError('You can add up to three evidence images.'); return; }
    const reader = new FileReader();
    reader.onload = () => setEvidence(prev => [...prev, String(reader.result)]);
    reader.readAsDataURL(file);
  }
  function complain(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); submitDispute.mutate({ token, data: { reason: String(f.get('reason')) as typeof DisputeInputReason[keyof typeof DisputeInputReason], description: String(f.get('description')), evidenceUrls: evidence } }, { onSuccess: () => { setMode('done'); setMessage('Your concern has been submitted. The simulated payment is frozen while it is reviewed.'); setError(''); refresh(); }, onError: () => setError('We could not submit the report. Please try again.') }); }
  if (query.isLoading) return <BuyerFrame><LoadingBlock /></BuyerFrame>;
  if (query.isError || !query.data) return <BuyerFrame><ErrorBlock retry={() => query.refetch()} text="This payment link could not be found. Ask the seller to send you a fresh link." /></BuyerFrame>;
  const o = query.data; const paid = o.status !== 'CREATED'; const complete = o.status === 'COMPLETED';
  const progressLabels = ['Created', 'Paid & held', 'Shipped', 'Delivered', 'Completed'];
  const progressStatuses = ['CREATED', 'PAID & HELD', 'SHIPPED', 'DELIVERED', 'COMPLETED'];
  const currentStep = o.status === 'DISPUTED' ? 3 : progressStatuses.indexOf(o.status);
  return <BuyerFrame><div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_360px]"><div>
    <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" />Secure buyer checkout <span className="ml-auto"><StatusPill status={o.status} /></span></div>
    {paid && <div className="mb-4 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm font-bold">Your Payment Is Protected by Garant</p><p className="mt-1 text-xs text-muted-foreground">Funds are held until you confirm your order arrived.</p></div></div>}
    {o.status === 'DELIVERED' && <Notice kind="info">If you do not confirm within 48 hours after delivery, the simulated payment releases automatically.</Notice>}
    {o.status === 'DISPUTED' && <Notice kind="info">Payment is frozen while the dispute is reviewed.</Notice>}
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-7"><div className="flex gap-4">{o.imageUrl && <img src={o.imageUrl} alt={o.productName} className="h-20 w-20 rounded-2xl object-cover" />}<div><p className="text-xs font-semibold text-primary">{o.storeName}</p><h1 className="display-font mt-1 text-2xl font-bold">{o.productName}</h1><p className="mt-1 text-sm text-muted-foreground">{o.description}</p></div></div>
      {!paid && mode === 'checkout' && <form onSubmit={checkout} className="mt-7 border-t border-border pt-6"><h2 className="text-sm font-bold">Your delivery details</h2><p className="mt-1 text-xs text-muted-foreground">No account needed. Just tell us where to send it.</p><label className="mt-5 block text-xs font-semibold">Full name<input name="name" required className={`${field} mt-1.5`} placeholder="Your name" /></label><label className="mt-4 block text-xs font-semibold">Kuwait phone number<input name="phone" required type="tel" className={`${field} mt-1.5`} placeholder="+965 XXXX XXXX" /></label><label className="mt-4 block text-xs font-semibold">Delivery address<textarea name="address" required rows={2} className={`${field} mt-1.5`} placeholder="Area, block, street, building…" /></label><p className="mb-2 mt-5 text-xs font-semibold">Choose payment</p><div className="grid grid-cols-2 gap-2"><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"><input type="radio" name="payment" value="KNET" defaultChecked />KNET</label><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"><input type="radio" name="payment" value="CARD" />Card</label></div><Notice kind="info">Demo only: payment is simulated. No real money will be charged.</Notice>{error && <Notice kind="error">{error}</Notice>}<Primary type="submit" disabled={pay.isPending} className="mt-3 w-full"><LockKeyhole className="h-4 w-4" />{pay.isPending ? 'Processing demo…' : `Pay ${fmt(o.totalAmount)}`}</Primary></form>}
      {mode === 'otp' && <form onSubmit={otp} className="mt-7 border-t border-border pt-6"><h2 className="text-sm font-bold">Verify delivery confirmation</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">This MVP simulates phone verification. No SMS is sent; use the demo code <b>123456</b>.</p><label className="mt-5 block text-xs font-semibold">One-time code<input name="code" required minLength={4} maxLength={8} inputMode="numeric" className={`${field} mt-1.5 text-center font-mono text-lg tracking-[.3em]`} placeholder="123456" /></label>{error && <Notice kind="error">{error}</Notice>}<Primary type="submit" disabled={verify.isPending || confirm.isPending} className="mt-4 w-full">{verify.isPending || confirm.isPending ? 'Verifying…' : 'Verify and continue'}</Primary></form>}
      {mode === 'done' && message && <Notice>{message}</Notice>}
      {paid && mode !== 'otp' && <div className="mt-7 border-t border-border pt-6"><h2 className="text-sm font-bold">{complete ? 'Order complete' : 'Your order journey'}</h2><div className="mt-5 space-y-0">{progressLabels.map((label, i) => { const done = currentStep >= i; return <div key={label} className="flex gap-3"><div className="flex flex-col items-center"><span className={`flex h-7 w-7 items-center justify-center rounded-full ${done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{done ? <Check className="h-4 w-4" /> : <span className="text-xs">{i + 1}</span>}</span>{i < progressLabels.length - 1 && <span className="h-8 w-px bg-border" />}</div><div className="pb-5"><p className="text-sm font-semibold">{label}</p><p className="mt-1 text-xs text-muted-foreground">{i === 1 ? 'Your payment is held in this demo.' : i === 2 && o.carrier ? `${o.carrier} · ${o.trackingNumber}` : i === 3 ? date(o.deliveredAt) : i === 4 && o.status === 'DISPUTED' ? 'Payment is frozen while the dispute is reviewed.' : i === 0 ? date(o.createdAt) : 'Waiting for the next order update.'}</p></div></div>; })}</div>
        {o.trackingUrl && <a href={o.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">Track shipment <ExternalLink className="h-4 w-4" /></a>}
        {o.status === 'DELIVERED' && mode !== 'complaint' && <div className="mt-4 grid gap-2 sm:grid-cols-2"><Primary onClick={confirmReceived} disabled={confirm.isPending}><CheckCircle2 className="h-4 w-4" />Received, All Good</Primary><Soft onClick={reportProblem}><AlertCircle className="h-4 w-4" />There’s a Problem</Soft></div>}
        {o.status === 'PAID & HELD' && <p className="rounded-xl bg-accent/50 p-3 text-xs leading-5 text-accent-foreground">Your payment is protected while the seller prepares your order.</p>}
        {o.status === 'DELIVERED' && mode === 'complaint' && <form onSubmit={complain} className="mt-5 space-y-3 rounded-2xl border border-border p-4"><h3 className="text-sm font-semibold">What went wrong?</h3><select name="reason" className={field}>{Object.values(DisputeInputReason).map(reason => <option key={reason} value={reason}>{reason.replaceAll('_', ' ').toLowerCase()}</option>)}</select><textarea name="description" required minLength={10} rows={3} className={field} placeholder="Tell us what happened (at least 10 characters)" /><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border p-3 text-xs"><FileImage className="h-4 w-4 text-primary" />Add photo evidence (up to 3 images)<input type="file" accept="image/*" className="sr-only" onChange={e => addEvidence(e.target.files?.[0])} /></label>{evidence.length > 0 && <div className="flex gap-2">{evidence.map((src, i) => <img key={`${i}`} src={src} alt={`Evidence preview ${i + 1}`} className="h-12 w-12 rounded-lg object-cover" />)}</div>}{error && <Notice kind="error">{error}</Notice>}<Primary type="submit" disabled={submitDispute.isPending}>{submitDispute.isPending ? 'Sending…' : 'Submit concern'}</Primary></form>}
      </div>}
      {error && paid && <Notice kind="error">{error}</Notice>}
    </section>
    <p className="mt-4 text-center text-[10px] text-muted-foreground">GARANT buyer protection · No account required · Payment simulation only</p>
  </div><aside className="h-fit rounded-3xl border border-border bg-card p-5 sm:p-6"><h2 className="text-sm font-bold">Order summary</h2><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between gap-4"><span className="text-muted-foreground">Item</span><span className="text-right">{o.productName}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Item price</span><Money>{fmt(o.productPrice)}</Money></div><div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><Money>{fmt(o.deliveryFee)}</Money></div><div className="border-t border-border pt-3"><div className="flex justify-between font-bold"><span>Total</span><Money>{fmt(o.totalAmount)}</Money></div></div></div><div className="mt-6 rounded-2xl bg-primary/5 p-4"><div className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" /><div><p className="text-xs font-bold">Protected checkout</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Funds are held until you confirm your order arrived.</p></div></div></div><p className="mt-5 text-[11px] leading-5 text-muted-foreground">Expected delivery<br /><b className="text-foreground">{date(o.expectedDeliveryDate)}</b></p><div className="mt-4 border-t border-border pt-4 text-[11px] text-muted-foreground">Sold by <b className="text-foreground">{o.storeName}</b></div></aside></div></BuyerFrame>;
}
function BuyerFrame({ children }: { children: ReactNode }) { return <main className="min-h-[100dvh] bg-background px-4 py-5 sm:px-6 sm:py-8"><div className="mx-auto mb-7 flex max-w-5xl items-center justify-between"><Logo /><div className="flex items-center gap-3"><LanguageToggle /><ThemeToggle /><span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5 text-primary" />GARANT protected</span></div></div>{children}<div className="mt-10 text-center text-[10px] text-muted-foreground">Payments are simulated for this MVP. GARANT does not move real money.</div></main>; }

function SignInPage() { return <div className="grain flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8"><div className="absolute left-6 top-6"><Logo /></div><div className="absolute right-6 top-6 flex gap-2"><LanguageToggle /><ThemeToggle /></div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>; }
function SignUpPage() { return <div className="grain flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8"><div className="absolute left-6 top-6"><Logo /></div><div className="absolute right-6 top-6 flex gap-2"><LanguageToggle /><ThemeToggle /></div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>; }
function HomeRedirect() { return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><Home /></Show></>; }
function ClerkCacheInvalidator() {
  const { addListener } = useClerk(); const client = useQueryClient();
  useEffect(() => { let previous: string | null | undefined; return addListener(({ user }) => { const id = user?.id ?? null; if (previous !== undefined && previous !== id) client.clear(); previous = id; }); }, [addListener, client]);
  return null;
}
function ClerkApp() {
  const [, setLocation] = useLocation();
  const { dark, lang } = useLocale();
  const appearance = {
    theme: shadcn, cssLayerName: 'clerk',
    options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
    variables: { colorPrimary: '#7C3AED', colorForeground: dark ? '#F3F4FF' : '#101832', colorMutedForeground: dark ? '#A9B0CC' : '#59617B', colorDanger: '#F87171', colorBackground: dark ? '#101832' : '#FFFFFF', colorInput: dark ? '#080D24' : '#F8F8FC', colorInputForeground: dark ? '#F3F4FF' : '#101832', colorNeutral: dark ? '#F3F4FF' : '#101832', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Text, SF Pro Display, Segoe UI, sans-serif', borderRadius: '0.8rem' },
    elements: { rootBox: 'w-full flex justify-center', cardBox: `${dark ? 'bg-[#101832]' : 'bg-white'} rounded-2xl w-[440px] max-w-full overflow-hidden`, card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none', headerTitle: `${dark ? 'text-[#F3F4FF]' : 'text-[#101832]'} font-bold`, headerSubtitle: dark ? 'text-[#A9B0CC]' : 'text-[#59617B]', socialButtonsBlockButtonText: dark ? 'text-[#F3F4FF]' : 'text-[#101832]', formFieldLabel: dark ? 'text-[#F3F4FF]' : 'text-[#101832]', footerActionLink: 'text-[#A855F7]', footerActionText: dark ? 'text-[#A9B0CC]' : 'text-[#59617B]', dividerText: dark ? 'text-[#A9B0CC]' : 'text-[#59617B]', identityPreviewEditButton: 'text-[#A855F7]', formFieldSuccessText: 'text-[#A855F7]', alertText: dark ? 'text-[#F3F4FF]' : 'text-[#101832]', logoBox: 'mb-2', logoImage: 'max-h-9', socialButtonsBlockButton: dark ? 'border-[#273150] rounded-xl' : 'border-[#dedfe8] rounded-xl', formButtonPrimary: 'rounded-xl', formFieldInput: dark ? 'rounded-xl border-[#273150]' : 'rounded-xl border-[#dedfe8]', footerAction: 'border-0', dividerLine: dark ? 'bg-[#273150]' : 'bg-[#dedfe8]', alert: 'rounded-xl', otpCodeFieldInput: 'rounded-xl', formFieldRow: 'gap-2', main: 'gap-4' },
  };
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: lang === 'ar' ? 'مرحباً بعودتك' : 'Welcome back', subtitle: lang === 'ar' ? 'سجّل الدخول إلى مساحة عمل GARANT الخاصة بك' : 'Sign in to your GARANT seller workspace' } }, signUp: { start: { title: lang === 'ar' ? 'ابدأ البيع بثقة' : 'Start selling with confidence', subtitle: lang === 'ar' ? 'أنشئ حساب التاجر في GARANT' : 'Create your GARANT merchant account' } } }} routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })}>
    <QueryClientProvider client={queryClient}><HealthMonitor /><ClerkCacheInvalidator /><Switch>
      <Route path="/"><HomeRedirect /></Route>
      <Route path="/sign-in/*?" component={SignInPage} /><Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/pay/:token" component={BuyerOrder} />
      <Route path="/dashboard"><Protected><MerchantGate><Layout><Dashboard /></Layout></MerchantGate></Protected></Route>
      <Route path="/orders"><Protected><MerchantGate><Layout><Orders /></Layout></MerchantGate></Protected></Route>
      <Route path="/create-link"><Protected><MerchantGate><Layout><CreateLink /></Layout></MerchantGate></Protected></Route>
      <Route path="/disputes"><Protected><MerchantGate><Layout><Disputes /></Layout></MerchantGate></Protected></Route>
      <Route path="/settings"><Protected><MerchantGate><Layout><SettingsPage /></Layout></MerchantGate></Protected></Route>
      <Route path="/admin"><Protected><MerchantGate><Layout><Admin /></Layout></MerchantGate></Protected></Route><Route component={NotFound} />
    </Switch></QueryClientProvider>
  </ClerkProvider>;
}
function HealthMonitor() { useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), staleTime: 60_000 } }); return null; }
function App() {
  const [lang, setLang] = useState<Lang>(() => localStorage.getItem('garant-language') === 'ar' ? 'ar' : 'en');
  const [dark, setDark] = useState(() => localStorage.getItem('garant-theme') !== 'light');
  useLayoutEffect(() => { document.documentElement.classList.toggle('dark', dark); document.documentElement.style.colorScheme = dark ? 'dark' : 'light'; localStorage.setItem('garant-theme', dark ? 'dark' : 'light'); }, [dark]);
  useLayoutEffect(() => {
    const direction = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = direction;
    document.body.dir = direction;
    document.documentElement.lang = lang;
    localStorage.setItem('garant-language', lang);
    applyArabicCopy(lang);
    const observer = new MutationObserver(() => applyArabicCopy(lang));
    observer.observe(document.body, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title', 'alt'] });
    return () => observer.disconnect();
  }, [lang]);
  return <LocaleContext.Provider value={{ lang, setLang, dark, setDark }}><TooltipProvider><WouterRouter base={basePath}><ClerkApp /></WouterRouter><Toaster /></TooltipProvider></LocaleContext.Provider>;
}
export default App;
