import { ClipboardList, Plus } from 'lucide-react';
import { PageHeader, Card, CardContent, Button, EmptyState } from '@/components/ui';

export default function Orders() {
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Orders"
        description="View and manage all orders"
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />}>
            New Order
          </Button>
        }
      />

      <Card>
        <CardContent>
          <EmptyState
            icon={<ClipboardList className="h-12 w-12" />}
            title="No orders yet"
            description="Orders will appear here once they are created. Start by creating a new order."
          />
        </CardContent>
      </Card>
    </div>
  );
}
