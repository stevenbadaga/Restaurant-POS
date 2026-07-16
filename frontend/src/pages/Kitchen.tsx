import { ChefHat } from 'lucide-react';
import { PageHeader, Card, CardContent, EmptyState } from '@/components/ui';

export default function Kitchen() {
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Kitchen Display"
        description="Real-time kitchen order management"
      />

      <Card>
        <CardContent>
          <EmptyState
            icon={<ChefHat className="h-12 w-12" />}
            title="No active orders"
            description="Kitchen orders will appear here in real-time as they are placed."
          />
        </CardContent>
      </Card>
    </div>
  );
}
