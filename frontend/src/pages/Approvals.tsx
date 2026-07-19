import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { PageHeader, Card, CardContent, Button, Badge, Loading, EmptyState, ErrorState } from '@/components/ui';
import { approveApprovalRequest, getApprovalRequests, rejectApprovalRequest } from '@/services/approval-requests';
import { formatDate } from '@/lib';
import { cn } from '@/lib/utils';

const statuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export default function Approvals() {
  const [status, setStatus] = useState<(typeof statuses)[number]>('PENDING');
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getApprovalRequests({ status });
      setRequests(response.data.requests || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load approval requests');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { loadData(); }, [loadData]);

  const approve = async (request: any) => {
    setActingId(request.id);
    setError(null);
    try {
      await approveApprovalRequest(request.id);
      setSuccess('Request approved.');
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to approve request');
    } finally {
      setActingId(null);
    }
  };

  const reject = async (request: any) => {
    const reason = window.prompt('Rejection reason:');
    if (!reason) return;
    setActingId(request.id);
    setError(null);
    try {
      await rejectApprovalRequest(request.id, reason);
      setSuccess('Request rejected.');
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject request');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Approvals"
        description="Review refund, void, stock, attendance, and manager requests"
        actions={<Button variant="ghost" size="sm" onClick={loadData} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>}
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn(
              'px-3 py-1.5 text-xs rounded-lg border transition-colors',
              status === s ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]' : 'border-[var(--color-border)]'
            )}
          >
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {error && <ErrorState title="Error" message={error} action={<Button onClick={loadData}>Retry</Button>} />}
      {success && <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 text-sm text-green-700 dark:text-green-300">{success}</div>}

      {loading ? <Loading message="Loading approval requests..." /> : requests.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-12 w-12" />} title="No requests found" description={`No ${status.toLowerCase()} approval requests.`} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-text-muted)]">
                    <th className="px-4 py-3">Request</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Requested By</th>
                    <th className="px-4 py-3">Requested</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Reviewed By</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {requests.map((request) => (
                    <tr key={request.id} className="hover:bg-[var(--color-bg-secondary)]">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--color-text-primary)]">{request.title}</p>
                        <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">{request.description || '-'}</p>
                        {request.rejectionReason && <p className="text-xs text-red-500 mt-1">{request.rejectionReason}</p>}
                      </td>
                      <td className="px-4 py-3"><Badge variant="neutral">{request.requestType.replace(/_/g, ' ')}</Badge></td>
                      <td className="px-4 py-3 text-xs">{request.requestedBy?.firstName} {request.requestedBy?.lastName}</td>
                      <td className="px-4 py-3 text-xs">{formatDate(request.requestedAt)}</td>
                      <td className="px-4 py-3"><StatusBadge status={request.status} /></td>
                      <td className="px-4 py-3 text-xs">{request.reviewedBy ? `${request.reviewedBy.firstName} ${request.reviewedBy.lastName}` : '-'}</td>
                      <td className="px-4 py-3">
                        {request.status === 'PENDING' && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => approve(request)} isLoading={actingId === request.id} leftIcon={<CheckCircle2 className="h-4 w-4" />}>Approve</Button>
                            <Button size="sm" variant="danger" onClick={() => reject(request)} disabled={actingId === request.id} leftIcon={<XCircle className="h-4 w-4" />}>Reject</Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'APPROVED') return <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
  if (status === 'REJECTED') return <Badge variant="error"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
  return <Badge variant="warning"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
}
