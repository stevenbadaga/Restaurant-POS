import { ArrowLeft, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, CardContent, Button, EmptyState } from '@/components/ui';

export default function NewOrder() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="New Order"
        description="Create a new customer order"
        actions={
          <Button variant="ghost" onClick={() => navigate('/orders')} leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Back to Orders
          </Button>
        }
      />

      <Card>
        <CardContent>
          <EmptyState
            icon={<ClipboardList className="h-12 w-12" />}
            title="Order creation"
            description="The order creation interface will be implemented in a later phase."
          />
        </CardContent>
      </Card>
    </div>
  );
}
