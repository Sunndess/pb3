import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { Card } from '../ui/Card';

Chart.register(...registerables);

interface CaseStatusChartProps {
  data: { status: string; count: number }[];
  className?: string;
}

// Traducción de estados
const statusLabels: Record<string, string> = {
  pending_to_assignment: 'Por Asignar',
  pending_assignment: 'Por Hacer',
  pending_confirmation: 'Por Confirmar',
  recent: 'Reciente',
  completed: 'Finalizado',
  paused: 'Pausado',
};

export const CaseStatusChart: React.FC<CaseStatusChartProps> = ({ data, className = '' }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (chartRef.current) {
      // Destroy existing chart
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      
      if (ctx) {
        chartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: data.map(item => statusLabels[item.status] || item.status),
            datasets: [
              {
                label: 'Acciones',
                data: data.map(item => item.count),
                backgroundColor: [
                  'rgba(59, 130, 246, 0.8)',
                  'rgba(16, 185, 129, 0.8)',
                  'rgba(245, 158, 11, 0.8)',
                  'rgba(239, 68, 68, 0.8)',
                  'rgba(139, 92, 246, 0.8)',
                ],
                borderColor: [
                  'rgba(59, 130, 246, 1)',
                  'rgba(16, 185, 129, 1)',
                  'rgba(245, 158, 11, 1)',
                  'rgba(239, 68, 68, 1)',
                  'rgba(139, 92, 246, 1)',
                ],
                borderWidth: 1,
                borderRadius: 5,
                maxBarThickness: 50,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false,
              },
              tooltip: {
                callbacks: {
                  title: function(context) {
                    // Traduce el estado en el tooltip también
                    const label = context[0]?.label;
                    return label;
                  }
                }
              }
            },
            scales: {
              x: {
                grid: {
                  display: false,
                },
              },
              y: {
                beginAtZero: true,
                ticks: {
                  precision: 0,
                },
              },
            },
            animation: {
              duration: 2000,
            },
          },
        });
      }
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data]);

  return (
    <Card 
      title="Estado de Acciones"
      className={`${className}`}
    >
      <div className="h-64">
        <canvas ref={chartRef}></canvas>
      </div>
    </Card>
  );
};