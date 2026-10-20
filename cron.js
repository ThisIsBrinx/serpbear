/* eslint-disable no-new */
const Cryptr = require('cryptr');
const { promises, readFile, watchFile } = require('fs');
const { Cron } = require('croner');
require('dotenv').config({ path: './.env.local' });

// Build the internal base URL for cron→server requests.
// NEXT_PUBLIC_APP_URL is the external/browser URL which may use a different port
// (e.g. Docker -p 5000:3000). Inside the container the server listens on PORT (default 3000).
const getInternalBaseURL = () => {
   const serverPort = process.env.PORT || 3000;
   return `http://localhost:${serverPort}`;
};

const INTERNAL_BASE_URL = getInternalBaseURL();

const getAppSettings = async () => {
   const defaultSettings = {
      scraper_type: 'none',
      notification_interval: 'never',
      notification_email: '',
      smtp_server: '',
      smtp_port: '',
      smtp_username: '',
      smtp_password: '',
   };
   try {
      let decryptedSettings = {};
      const exists = await promises.stat(`${process.cwd()}/data/settings.json`).then(() => true).catch(() => false);
      if (exists) {
         const settingsRaw = await promises.readFile(`${process.cwd()}/data/settings.json`, { encoding: 'utf-8' });
         let settings;
         try {
            settings = settingsRaw ? JSON.parse(settingsRaw) : {};
         } catch (parseError) {
            // File exists but JSON is corrupt — back it up instead of overwriting
            const backupPath = `${process.cwd()}/data/settings.json.${Date.now()}.corrupt`;
            console.log(`[WARN] Corrupt settings.json detected. Backing up to ${backupPath}`);
            await promises.rename(`${process.cwd()}/data/settings.json`, backupPath).catch(() => {});
            await promises.writeFile(`${process.cwd()}/data/settings.json`, JSON.stringify(defaultSettings), { encoding: 'utf-8' }).catch(() => {});
            return defaultSettings;
         }

         try {
            const cryptr = new Cryptr(process.env.SECRET);
            const scaping_api = settings.scaping_api ? cryptr.decrypt(settings.scaping_api) : '';
            const smtp_password = settings.smtp_password ? cryptr.decrypt(settings.smtp_password) : '';
            decryptedSettings = { ...settings, scaping_api, smtp_password };
         } catch (error) {
            console.log('Error Decrypting Settings API Keys!');
         }
      } else {
         throw Error('Settings file don\'t exist.');
      }
      return decryptedSettings;
   } catch (error) {
      await promises.mkdir(`${process.cwd()}/data`, { recursive: true }).catch(() => {});
      await promises.writeFile(`${process.cwd()}/data/settings.json`, JSON.stringify(defaultSettings), { encoding: 'utf-8' }).catch(() => {});
      return defaultSettings;
   }
};

const generateCronTime = (interval) => {
   let cronTime = false;
   if (interval === 'hourly') {
      cronTime = '0 0 */1 * * *';
   }
   if (interval === 'daily') {
      cronTime = '0 0 0 * * *';
   }
   if (interval === 'other_day') {
      cronTime = '0 0 0 */2 * *'; // Robust 6-field: every 2 days at midnight
   }
   if (interval === 'daily_morning') {
      cronTime = '0 0 3 * * *';
   }
   if (interval === 'weekly') {
      cronTime = '0 0 0 * * 1'; // 6-field: every Monday at midnight
   }
   if (interval === 'monthly') {
      cronTime = '0 0 0 1 * *'; // 6-field: every 1st of month at midnight
   }

   return cronTime;
};

const cronOptions = {
   scheduled: true,
   timezone: process.env.TZ || undefined,
};

let activeJobs = [];

const stopActiveJobs = () => {
   if (activeJobs.length > 0) {
      console.log(`[CRON] Stopping ${activeJobs.length} active cron job(s)...`);
      activeJobs.forEach((job) => {
         try {
            job.stop();
         } catch (err) {
            // ignore
         }
      });
      activeJobs = [];
   }
};

const runAppCronJobs = async () => {
   stopActiveJobs();
   const settings = await getAppSettings();

   console.log(`[CRON] Initializing cron scheduler (TZ: ${process.env.TZ || 'system/UTC'})...`);

   // 1. RUN SERP Scraping CRON
   const scrape_interval = settings.scrape_interval || 'daily';
   if (scrape_interval !== 'never') {
      const scrapeCronTime = generateCronTime('daily');
      if (scrapeCronTime) {
         const serpJob = new Cron(scrapeCronTime, cronOptions, () => {
            console.log(`[${new Date().toISOString()}] [CRON] Running Keyword Position Scrape Job...`);
            const fetchOpts = { method: 'POST', headers: { Authorization: `Bearer ${process.env.APIKEY}` } };
            fetch(`${INTERNAL_BASE_URL}/api/cron`, fetchOpts)
            .then((res) => res.json())
            .then((data) => {
               console.log(`[${new Date().toISOString()}] [CRON] Scrape Job response:`, data?.message || data?.started);
            })
            .catch((err) => {
               console.log('[CRON ERROR] Making SERP Scraper Cron Request:', err.message || err);
            });
         });
         activeJobs.push(serpJob);
         console.log(`[CRON] SERP Scraping scheduled with interval "${scrape_interval}" (${scrapeCronTime}). Next run: ${serpJob.nextRun()}`);
      }
   } else {
      console.log('[CRON] SERP Scraping disabled ("never").');
   }

   // 2. RUN Email Notification CRON
   const notif_interval = (!settings.notification_interval || settings.notification_interval === 'never') ? false : settings.notification_interval;
   if (notif_interval) {
      const notifCronTime = generateCronTime(notif_interval === 'daily' ? 'daily_morning' : notif_interval);
      if (notifCronTime) {
         const notifJob = new Cron(notifCronTime, cronOptions, () => {
            console.log(`[${new Date().toISOString()}] [CRON] Sending Notification Email...`);
            const fetchOpts = { method: 'POST', headers: { Authorization: `Bearer ${process.env.APIKEY}` } };
            fetch(`${INTERNAL_BASE_URL}/api/notify`, fetchOpts)
            .then((res) => res.json())
            .then((data) => console.log(`[${new Date().toISOString()}] [CRON] Notification sent:`, data))
            .catch((err) => {
               console.log('[CRON ERROR] Making Cron Email Notification Request:', err.message || err);
            });
         });
         activeJobs.push(notifJob);
         console.log(`[CRON] Email Notifications scheduled with interval "${notif_interval}". Next run: ${notifJob.nextRun()}`);
      }
   }

   // 3. RUN Failed scraping CRON (Every Hour)
   const failedCronTime = generateCronTime('hourly');
   const failedJob = new Cron(failedCronTime, cronOptions, () => {
      readFile(`${process.cwd()}/data/failed_queue.json`, { encoding: 'utf-8' }, (err, data) => {
         if (data) {
            try {
               const keywordsToRetry = data ? JSON.parse(data) : [];
               if (keywordsToRetry.length > 0) {
                  console.log(`[${new Date().toISOString()}] [CRON] Retrying ${keywordsToRetry.length} failed scrape(s)...`);
                  const fetchOpts = { method: 'POST', headers: { Authorization: `Bearer ${process.env.APIKEY}` } };
                  fetch(`${INTERNAL_BASE_URL}/api/refresh?id=${keywordsToRetry.join(',')}`, fetchOpts)
                  .then((res) => res.json())
                  .then((refreshedData) => console.log(`[${new Date().toISOString()}] [CRON] Failed scrapes retry result:`, refreshedData))
                  .catch((fetchErr) => {
                     console.log('[CRON ERROR] Making failed_queue Cron Request:', fetchErr.message || fetchErr);
                  });
               }
            } catch (error) {
               console.log('[CRON ERROR] Parsing Failed Scrapes Queue File:', error.message || error);
            }
         }
      });
   });
   activeJobs.push(failedJob);

   // 4. RUN Google Search Console Scraper Daily
   if (process.env.SEARCH_CONSOLE_PRIVATE_KEY && process.env.SEARCH_CONSOLE_CLIENT_EMAIL) {
      const searchConsoleCRONTime = generateCronTime('daily');
      const scJob = new Cron(searchConsoleCRONTime, cronOptions, () => {
         console.log(`[${new Date().toISOString()}] [CRON] Running Search Console Scraper...`);
         const fetchOpts = { method: 'POST', headers: { Authorization: `Bearer ${process.env.APIKEY}` } };
         fetch(`${INTERNAL_BASE_URL}/api/searchconsole`, fetchOpts)
         .then((res) => res.json())
         .then((data) => console.log(`[${new Date().toISOString()}] [CRON] Search Console Scrape result:`, data))
         .catch((err) => {
            console.log('[CRON ERROR] Making Google Search Console Scraper Cron Request:', err.message || err);
         });
      });
      activeJobs.push(scJob);
   }
};

// Start initial jobs
runAppCronJobs();

// Dynamically watch settings file for changes so scheduler updates without Docker restart
let reloadTimeout = null;
try {
   watchFile(`${process.cwd()}/data/settings.json`, { interval: 5000 }, (curr, prev) => {
      if (curr.mtimeMs !== prev.mtimeMs) {
         console.log('[CRON] Detected changes in settings.json. Reloading scheduler in 2s...');
         if (reloadTimeout) clearTimeout(reloadTimeout);
         reloadTimeout = setTimeout(() => {
            runAppCronJobs();
         }, 2000);
      }
   });
} catch (watchErr) {
   // File watch error non-fatal
}
