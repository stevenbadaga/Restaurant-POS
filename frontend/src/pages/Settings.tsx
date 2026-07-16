import { Settings as SettingsIcon } from 'lucide-react';
import { PageHeader, Card, CardContent, EmptyState } from '@/components/ui';

export default function Settings() {
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Settings"
        description="Configure system preferences"
      />

      <Card>
        <CardContent>
          <EmptyState
            icon={<SettingsIcon className="h-12 w-12" />}
            title="Settings"
            description="Restaurant settings, user preferences, and system configuration will be available here."
          />
        </CardContent>
      </Card>
    </div>
  );
}
