import { Card, CardContent } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';

interface ChartDataPoint {
  label: string;
  value: number;
  [key: string]: any;
}

interface ReportChartCardProps {
  title: string;
  data: ChartDataPoint[];
  type?: 'line' | 'bar' | 'pie' | 'area';
  dataKeys?: string[];
  colors?: string[];
  loading?: boolean;
  height?: number;
  formatValue?: (value: number) => string;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

const DEFAULT_COLORS = [
  'var(--color-accent, #2563eb)',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

function CustomTooltip({ active, payload, label, formatValue }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatValue ? formatValue(entry.value) : entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

export function ReportChartCard({
  title, data, type = 'bar', dataKeys, colors = DEFAULT_COLORS,
  loading, height = 300, formatValue, xAxisLabel, yAxisLabel,
}: ReportChartCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <Loading size="sm" message="Loading chart..." />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.length) {
    return (
      <Card>
        <CardContent>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">{title}</h3>
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-sm text-[var(--color-text-muted)]">No data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const keys = dataKeys || ['value'];

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" stroke="var(--color-text-muted)" fontSize={12} />
              <YAxis stroke="var(--color-text-muted)" fontSize={12} tickFormatter={formatValue} />
              <Tooltip content={<CustomTooltip formatValue={formatValue} />} />
              <Legend />
              {keys.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[i % colors.length]}
                  strokeWidth={2}
                  dot={{ fill: colors[i % colors.length] }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" stroke="var(--color-text-muted)" fontSize={12} />
              <YAxis stroke="var(--color-text-muted)" fontSize={12} tickFormatter={formatValue} />
              <Tooltip content={<CustomTooltip formatValue={formatValue} />} />
              <Legend />
              {keys.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={colors[i % colors.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={50}
                label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip formatValue={formatValue} />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" stroke="var(--color-text-muted)" fontSize={12} />
              <YAxis stroke="var(--color-text-muted)" fontSize={12} />
              <Tooltip />
              <Bar dataKey="value" fill={colors[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <Card>
      <CardContent>
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">{title}</h3>
        {renderChart()}
      </CardContent>
    </Card>
  );
}
