importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// To register the service worker, we must give it the same config config.
// The easiest way is to use URL params or just hardcode for the public SW, 
// but since this is a public file, we'll initialize a basic app that just intercepts.
// Actually, firebase-messaging-sw requires the initialized app with at least projectId, apiKey, messagingSenderId, appId.

const firebaseConfig = new URL(location).searchParams.get("config");

if (firebaseConfig) {
    firebase.initializeApp(JSON.parse(firebaseConfig));
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);
        const notificationTitle = payload.notification.title;
        const notificationOptions = {
            body: payload.notification.body,
            icon: '/vite.svg'
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });
} else {
    // If not passed via URL, it tries to pick it up from default mechanisms or we can hardcode for this project structure.
    // For production, the builder might inject it. Let's provide a fallback listener just in case.
    self.addEventListener('push', (event) => {
        const payload = event.data.json();
        self.registration.showNotification(payload.notification.title, {
            body: payload.notification.body,
            icon: '/vite.svg'
        });
    });
}
