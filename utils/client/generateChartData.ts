type ChartData = {
   labels: string[],
   series: number[]
}

const parseDateKey = (dateStr: string): number => {
   const parts = dateStr.split('-').map(Number);
   if (parts.length === 3 && !parts.some(Number.isNaN)) {
      return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
   }
   return new Date(dateStr).getTime();
};

export const generateChartData = (history: KeywordHistory): ChartData => {
   const currentDate = new Date();
   const priorDates: string[] = [];
   const seriesDates: number[] = [];

   const startTimestamp = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate() - 30,
   ).getTime();

   let lastFoundSerp = 0;
   const sortedHistory = Object.keys(history)
      .map((key) => ({ key, timestamp: parseDateKey(key), pos: history[key] }))
      .filter((item) => !Number.isNaN(item.timestamp))
      .sort((a, b) => a.timestamp - b.timestamp);

   for (let i = 0; i < sortedHistory.length; i += 1) {
      if (sortedHistory[i].timestamp <= startTimestamp) {
         const { pos } = sortedHistory[i];
         lastFoundSerp = (pos && pos > 0 && pos <= 100) ? pos : 111;
      } else {
         break;
      }
   }

   // First Generate Labels. The labels should be the last 30 days dates. Format: 26/10
   for (let index = 30; index >= 0; index -= 1) {
      const pastDate = new Date(
         currentDate.getFullYear(),
         currentDate.getMonth(),
         currentDate.getDate() - index,
      );
      priorDates.push(`${pastDate.getDate()}/${pastDate.getMonth() + 1}`);

      const pastDateKey = `${pastDate.getFullYear()}-${pastDate.getMonth() + 1}-${pastDate.getDate()}`;
      if (history[pastDateKey] !== undefined) {
         const pos = history[pastDateKey];
         lastFoundSerp = (pos && pos > 0 && pos <= 100) ? pos : 111;
      }
      const serpVal = (lastFoundSerp > 0) ? lastFoundSerp : 111;
      seriesDates.push(serpVal);
   }

   return { labels: priorDates, series: seriesDates };
};

export const generateTheChartData = (history: KeywordHistory, time: string = '30'): ChartData => {
   const currentDate = new Date();
   const chartData: ChartData = { labels: [], series: [] };

   if (time === 'all') {
      const sortedKeys = Object.keys(history).sort((a, b) => parseDateKey(a) - parseDateKey(b));
      sortedKeys.forEach((dateKey) => {
         const val = history[dateKey];
         const serpVal = (val && val > 0 && val <= 100) ? val : 111;
         chartData.labels.push(dateKey);
         chartData.series.push(serpVal);
      });
      return chartData;
   }

   const daysCount = parseInt(time, 10);
   const startTimestamp = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate() - daysCount,
   ).getTime();

   let lastFoundSerp = 0;
   const sortedHistory = Object.keys(history)
      .map((key) => ({ key, timestamp: parseDateKey(key), pos: history[key] }))
      .filter((item) => !Number.isNaN(item.timestamp))
      .sort((a, b) => a.timestamp - b.timestamp);

   for (let i = 0; i < sortedHistory.length; i += 1) {
      if (sortedHistory[i].timestamp <= startTimestamp) {
         const { pos } = sortedHistory[i];
         lastFoundSerp = (pos && pos > 0 && pos <= 100) ? pos : 111;
      } else {
         break;
      }
   }

   for (let index = daysCount; index >= 0; index -= 1) {
      const pastDate = new Date(
         currentDate.getFullYear(),
         currentDate.getMonth(),
         currentDate.getDate() - index,
      );
      const pastDateKey = `${pastDate.getFullYear()}-${pastDate.getMonth() + 1}-${pastDate.getDate()}`;
      if (history[pastDateKey] !== undefined) {
         const pos = history[pastDateKey];
         lastFoundSerp = (pos && pos > 0 && pos <= 100) ? pos : 111;
      }
      const serpVal = (lastFoundSerp > 0) ? lastFoundSerp : 111;
      chartData.labels.push(pastDateKey);
      chartData.series.push(serpVal);
   }

   return chartData;
};
