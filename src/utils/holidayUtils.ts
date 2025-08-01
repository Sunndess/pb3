export const isHoliday = (date: Date, holidays: { date: string }[]): boolean => {
  const formattedDate = date.toISOString().split('T')[0];
  return holidays.some(holiday => holiday.date === formattedDate);
};
