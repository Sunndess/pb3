import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { Card } from '../ui/Card';

Chart.register(...registerables);

interface CaseTypeChartProps {
  data: { type: string; count: number }[];
  className?: string;
}

export const CaseTypeChart: React.FC<CaseTypeChartProps> = ({ data, className = '' }) => {
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
          type: 'doughnut',
          data: {
            labels: data.map(item => item.type),
            datasets: [
              {
                data: data.map(item => item.count),
                backgroundColor: [
                  'rgba(59, 130, 246, 0.8)',
                  'rgba(16, 185, 129, 0.8)',
                  'rgba(245, 158, 11, 0.8)',
                  'rgba(239, 68, 68, 0.8)',
                  'rgba(139, 92, 246, 0.8)',
                  'rgba(20, 184, 166, 0.8)',
                ],
                borderColor: 'white',
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'right',
                labels: {
                  font: {
                    size: 12,
                  },
                  padding: 20,
                  // Permite que los nombres largos se muestren completos
                  boxWidth: 18,
                  boxHeight: 18,
                  usePointStyle: true,
                  textAlign: 'left',
                  // Ajusta el ancho máximo y permite el salto de línea
                  // maxWidth: 220, // Removed as it is not a valid property
                },
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    const label = context.label || '';
                    const value = context.raw || 0;
                    const total = context.dataset.data.reduce((acc: number, curr: number) => acc + curr, 0);
                    const percentage = Math.round((value as number / total) * 100);
                    return `${label}: ${value} (${percentage}%)`;
                  }
                }
              }
            },
            cutout: '60%',
            animation: {
              animateScale: true,
              animateRotate: true,
              duration: 2000,
            },
            layout: {
              padding: {
                right: 40 // Agrega espacio a la derecha para los nombres largos
              }
            }
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
      title="Cantidad de Casos por Colaborador"
      className={`${className}`}
    >
      <div className="h-64 min-w-[380px]">
        <canvas ref={chartRef}></canvas>
      </div>
    </Card>
  );
};