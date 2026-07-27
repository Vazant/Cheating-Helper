const WebSocket = require('ws');
const fs = require('fs');

async function main() {
    const endpoint = process.argv[2] || 'http://127.0.0.1:9223/json/list';
    const targets = await (await fetch(endpoint)).json();
    if (targets.length !== 1) throw new Error(`Expected one renderer target, found ${targets.length}`);

    const socket = new WebSocket(targets[0].webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
    });

    let nextId = 0;
    const pending = new Map();
    socket.on('message', raw => {
        const message = JSON.parse(String(raw));
        const callback = pending.get(message.id);
        if (!callback) return;
        pending.delete(message.id);
        if (message.error) callback.reject(new Error(message.error.message));
        else callback.resolve(message.result);
    });
    const call = (method, params = {}) =>
        new Promise((resolve, reject) => {
            const id = ++nextId;
            pending.set(id, { resolve, reject });
            socket.send(JSON.stringify({ id, method, params }));
        });

    const viewportWidth = Number(process.argv[4]);
    if (viewportWidth) {
        await call('Emulation.setDeviceMetricsOverride', {
            width: viewportWidth,
            height: 900,
            deviceScaleFactor: 1,
            mobile: false,
        });
    }

    const expression = `(() => {
        const app = document.querySelector('cheating-daddy-app');
        return JSON.stringify({
            ready: document.readyState,
            app: Boolean(app),
            view: app?.currentView,
            storageLoaded: app?._storageLoaded,
            storageError: app?._storageError,
            language: app?.selectedLanguage,
            profile: app?.selectedProfile,
            rootText: (app?.shadowRoot?.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 500)
        });
    })()`;
    const result = await call('Runtime.evaluate', { expression, returnByValue: true });
    const settingsResult = await call('Runtime.evaluate', {
        expression: `(async () => {
            const app = document.querySelector('cheating-daddy-app');
            app.navigate('customize');
            await app.updateComplete;
            const settings = app.shadowRoot.querySelector('customize-view');
            await settings.updateComplete;
            return JSON.stringify({
                mode: settings.speechCaptureMode,
                audioMode: settings.audioMode,
                microphoneDeviceId: settings.microphoneDeviceId,
                microphoneCount: settings.microphoneDevices.length,
                systemShortcut: settings.keybinds.toggleSystemAudio,
                microphoneShortcut: settings.keybinds.toggleMicrophone,
                hasOldShortcut: Object.hasOwn(settings.keybinds, 'toggleSpeechCapture'),
                language: settings.shadowRoot.querySelector('#speech-language')?.value,
                languageLabel: settings.shadowRoot.querySelector('#speech-language')?.selectedOptions[0]?.textContent.trim(),
                overflowingElements: [...settings.shadowRoot.querySelectorAll('*')]
                    .filter(element => element.scrollWidth > element.clientWidth + 1)
                    .map(element => ({
                        tag: element.tagName,
                        className: element.className,
                        clientWidth: element.clientWidth,
                        scrollWidth: element.scrollWidth
                    })),
                controlWidths: [...settings.shadowRoot.querySelectorAll('.control')].slice(0, 4).map(
                    element => Math.round(element.getBoundingClientRect().width)
                ),
                text: (settings.shadowRoot?.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 1200)
            });
        })()`,
        awaitPromise: true,
        returnByValue: true,
    });
    const profileResult = await call('Runtime.evaluate', {
        expression: `(async () => {
            const app = document.querySelector('cheating-daddy-app');
            app.navigate('ai-customize');
            await app.updateComplete;
            const profiles = app.shadowRoot.querySelector('ai-customize-view');
            await profiles.updateComplete;
            const select = profiles.shadowRoot.querySelector('#session-profile');
            return JSON.stringify({
                profile: select?.value,
                profileLabel: select?.selectedOptions[0]?.textContent.trim()
            });
        })()`,
        awaitPromise: true,
        returnByValue: true,
    });
    const screenshotPath = process.argv[3];
    if (screenshotPath) {
        const screenshot = await call('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: true,
        });
        fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    }
    socket.close();
    console.log(result.result.value);
    console.log(settingsResult.result.value);
    console.log(profileResult.result.value);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
