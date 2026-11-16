import { Card, CardContent } from '@/components/ui/card';
import { Velaris } from '@/components/ui/velaris';
import { AlertCircle } from 'lucide-react';

const GARANT_VELARIS_COLORS = ['#A855F7', '#7C3AED', '#101832', '#080D24'];

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <Velaris
            bg="#080D24"
            colors={GARANT_VELARIS_COLORS}
            speed={0.48}
            grain={0.1}
            height="auto"
            className="rounded-xl"
          >
            <div className="flex items-center gap-2 p-4 text-[#F3F4FF]">
              <AlertCircle className="h-8 w-8 shrink-0 text-[#C4B5FD]" />
              <h1 className="text-2xl font-bold">404 Page Not Found</h1>
            </div>
          </Velaris>

          <p className="mt-4 text-sm text-muted-foreground">
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
