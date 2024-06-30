import express from 'express';
import { Builder } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import OBSWebSocket from 'obs-websocket-js';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

// OBS WebSocket settings
const OBS_HOST = 'localhost';
const OBS_PORT = 4455;
const OBS_PASSWORD = 'oS2YWqUjFtKpcuxm';

// Initialize OBS WebSocket
const obs = new OBSWebSocket();

// Connect to OBS WebSocket
async function connectOBS() {
  try {
    await obs.connect(`ws://${OBS_HOST}:${OBS_PORT}`, OBS_PASSWORD);
    console.log('Connected to OBS WebSocket');
  } catch (err) {
    console.error(`Connection to OBS WebSocket failed: ${err}`);
    process.exit(1);
  }
}

connectOBS();

// Selenium settings
const options = new chrome.Options();
options.addArguments('--no-sandbox', '--disable-dev-shm-usage');
const driver = new Builder().forBrowser('chrome').setChromeOptions(options).build();

async function openWebsite(url) {
  try {
    await driver.manage().window().maximize(); // Maximize the window
    await driver.get(url);
    await driver.sleep(3000); // Wait for the page to load
    // Bring the window to the foreground
    await driver.executeScript("window.focus();");
    console.log(`Opened website: ${url}`);
  } catch (err) {
    console.error(`Error opening website: ${err}`);
  }
}

async function getWindowIdentifier(url) {
  try {
    const handles = await driver.getAllWindowHandles();
    console.log('Window handles:', handles);

    for (const handle of handles) {
      await driver.switchTo().window(handle);
      const currentUrl = await driver.getCurrentUrl();
      console.log(`Window handle: ${handle}, URL: ${currentUrl}`);
      if (currentUrl === url || currentUrl.includes(url)) {
        const title = await driver.getTitle();
        console.log('Current window title:', title);
        return { title, handle };
      }
    }
    // If no matching window is found, log an error and return null
    console.error('No matching window found for the given URL');
    return null;
  } catch (err) {
    console.error(`Error getting window identifier: ${err}`);
    return null;
  }
}

async function getOBSWindows() {
  try {
    const { inputs } = await obs.call('GetInputList');
    const windows = inputs.filter(input => input.inputKind === 'window_capture');
    console.log('Available OBS windows:', windows.map(window => window.inputSettings.window));
    return windows;
  } catch (err) {
    console.error(`Error getting OBS windows: ${err}`);
    return [];
  }
}

async function scrollPage(duration) {
  const scrollPauseTime = 500;
  const endTime = Date.now() + duration * 1000;

  while (Date.now() < endTime) {
    await driver.executeScript('window.scrollBy(0, window.innerHeight);');
    await driver.sleep(scrollPauseTime);
  }
}

app.post('/record', async (req, res) => {
  const { website } = req.body;
  console.log(`Recording for website: ${website}`);

  // Open the prospect's website
  await openWebsite(website);

  // Get the window identifier
  const windowInfo = await getWindowIdentifier(website);
  if (!windowInfo) {
    res.status(500).json({ status: 'failed to find the window with the specified URL' });
    return;
  }

  const { title, handle } = windowInfo;
  console.log('Window title:', title);
  console.log('Window handle:', handle);

  // Get the available windows from OBS
  const obsWindows = await getOBSWindows();

  // Find the first window in OBS that is from Chrome
  const matchingWindow = obsWindows.find(window => window.inputSettings && window.inputSettings.window && window.inputSettings.window.includes('chrome.exe'));
  if (!matchingWindow) {
    console.error('No matching window found in OBS for Chrome');
    res.status(500).json({ status: 'failed to find a Chrome window in OBS' });
    return;
  }

  console.log('Matching OBS window:', matchingWindow);

  // Generate a unique source name
  const uniqueSourceName = `BrowserCapture-${uuidv4()}`;
  console.log('Unique source name:', uniqueSourceName);

  // Set up the scene and source to capture the browser window
  try {
    await obs.call('CreateInput', {
      sceneName: 'Scene',
      inputName: uniqueSourceName,
      inputKind: 'window_capture',
      inputSettings: {
        window: matchingWindow.inputSettings.window,
        match_priority: 'title'
      },
      sceneItemEnabled: true
    });
    console.log('Scene and source set up for recording by title');
  } catch (err) {
    console.error('Failed to set up scene and source by title:', err);
    res.status(500).json({ status: 'failed to set up scene and source' });
    return;
  }

  // Start recording
  try {
    await obs.call('StartRecord');
    console.log('Recording started');
  } catch (err) {
    console.error('Failed to start recording:', err);
    res.status(500).json({ status: 'failed to start recording' });
    return;
  }

  // Duration of the video in seconds (adjust according to your video length)
  const videoDuration = 5;

  // Scroll the page while the video is playing
  await scrollPage(videoDuration);

  // Wait for the video to finish
  await new Promise(resolve => setTimeout(resolve, videoDuration * 1000));

  // Stop recording
  let recordingPath;
  try {
    const stopRecordResponse = await obs.call('StopRecord');
    recordingPath = stopRecordResponse.outputPath;
    console.log('Recording stopped, file saved to:', recordingPath);
  } catch (err) {
    console.error('Failed to stop recording:', err);
    res.status(500).json({ status: 'failed to stop recording' });
    return;
  }

  // Wait a moment to ensure OBS has finished writing the file
  await new Promise(resolve => setTimeout(resolve, 5000));

  res.json({ status: 'recording complete', recordingPath });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
