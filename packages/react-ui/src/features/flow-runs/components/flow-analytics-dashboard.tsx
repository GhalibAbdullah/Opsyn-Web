'use client';

import dayjs from 'dayjs';
import { t } from 'i18next';
import * as React from 'react';
import { DateRange } from 'react-day-picker';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { DateTimePickerWithRange } from '@/components/ui/date-time-picker-range';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FlowAnalytics } from '@activepieces/shared';
import { flowRunsHooks } from '../lib/flow-runs-hooks';
import { authenticationSession } from '@/lib/authentication-session';

type FlowAnalyticsDashboardProps = {
  flowId: string;
};

export function FlowAnalyticsDashboard({ flowId }: FlowAnalyticsDashboardProps) {
  const [selectedDateRange, setSelectedDateRange] = React.useState<
    DateRange | undefined
  >({
    from: dayjs().subtract(30, 'days').toDate(),
    to: dayjs().toDate(),
  });

  const { data: analytics, isLoading, error, isError } = flowRunsHooks.useFlowAnalytics({
    flowId,
    startDate: selectedDateRange?.from?.toISOString(),
    endDate: selectedDateRange?.to?.toISOString(),
  });

  const runsOverTimeChartData =
    analytics?.runsOverTime.map((data: { day: string; totalRuns: number; successfulRuns: number; failedRuns: number }) => ({
      date: data.day,
      totalRuns: data.totalRuns,
      successfulRuns: data.successfulRuns,
      failedRuns: data.failedRuns,
    })) || [];

  const runsOverTimeChartConfig = {
    totalRuns: {
      label: t('Total Runs'),
      color: 'hsl(var(--chart-1))',
    },
    successfulRuns: {
      label: t('Successful'),
      color: 'hsl(var(--chart-2))',
    },
    failedRuns: {
      label: t('Failed'),
      color: 'hsl(var(--destructive))',
    },
  } satisfies ChartConfig;

  const executionTimeChartData =
    analytics?.runsOverTime
      .filter((data: { averageExecutionTime?: number }) => data.averageExecutionTime !== undefined)
      .map((data: { day: string; averageExecutionTime?: number }) => ({
        date: data.day,
        avgTime: data.averageExecutionTime ? Math.round(data.averageExecutionTime / 1000) : 0, // Convert to seconds
      })) || [];

  const executionTimeChartConfig = {
    avgTime: {
      label: t('Average Execution Time (s)'),
      color: 'hsl(var(--chart-3))',
    },
  } satisfies ChartConfig;

  if (isError) {
    return (
      <div className="flex flex-col gap-6 w-full">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{t('Flow Analytics')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('Performance metrics and insights for this flow')}
            </p>
          </div>
        </div>
        <div className="text-center py-8 text-destructive">
          <p>{t('Error loading analytics data')}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {error instanceof Error ? error.message : String(error)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{t('Flow Analytics')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('Performance metrics and insights for this flow')}
          </p>
        </div>
        <DateTimePickerWithRange
          onChange={setSelectedDateRange}
          from={selectedDateRange?.from?.toISOString()}
          to={selectedDateRange?.to?.toISOString()}
          maxDate={new Date()}
          presetType="past"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : analytics ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('Total Runs')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalRuns}</div>
                <p className="text-xs text-muted-foreground">
                  {t('In selected period')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('Success Rate')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics.successRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {analytics.successfulRuns} {t('successful')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('Failure Rate')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {analytics.failureRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {analytics.failedRuns} {t('failed')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('Avg Execution Time')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics.averageExecutionTime
                    ? `${Math.round(analytics.averageExecutionTime / 1000)}s`
                    : t('N/A')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('Across all runs')}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('Runs Over Time')}</CardTitle>
              <CardDescription>
                {t('Total, successful, and failed runs by day')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={runsOverTimeChartConfig}
                className="aspect-auto h-[300px] w-full"
              >
                <LineChart
                  accessibilityLayer
                  data={runsOverTimeChartData}
                  margin={{
                    left: 12,
                    right: 12,
                    top: 12,
                    bottom: 12,
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={32}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      });
                    }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) => {
                          return new Date(value).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          });
                        }}
                      />
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="totalRuns"
                    stroke={`var(--color-totalRuns)`}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="successfulRuns"
                    stroke={`var(--color-successfulRuns)`}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="failedRuns"
                    stroke={`var(--color-failedRuns)`}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {executionTimeChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('Average Execution Time')}</CardTitle>
                <CardDescription>
                  {t('Average execution time by day (in seconds)')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={executionTimeChartConfig}
                  className="aspect-auto h-[250px] w-full"
                >
                  <BarChart
                    accessibilityLayer
                    data={executionTimeChartData}
                    margin={{
                      left: 12,
                      right: 12,
                      top: 12,
                      bottom: 12,
                    }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={32}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        });
                      }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) => {
                            return new Date(value).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            });
                          }}
                        />
                      }
                    />
                    <Bar dataKey="avgTime" fill={`var(--color-avgTime)`} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          {t('No analytics data available')}
        </div>
      )}
    </div>
  );
}

