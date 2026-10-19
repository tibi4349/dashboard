// --- Lejátszási Lista Váltó Függvény ---
function switchPlaylist(playlistId, btnElement) {
    const iframe = document.getElementById('spotify-player');
    if (iframe) {
        iframe.src = `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&si=13212ef0c4ea4c97`;
    }
    
    document.querySelectorAll('.playlist-btn').forEach(btn => btn.classList.remove('active'));
    if (btnElement) {
        btnElement.classList.add('active');
    }
}

// --- Időjárás Modul (Open-Meteo API cache-bustinggal) ---
let currentCity = localStorage.getItem('selectedCity') || 'Budapest';
let lastWeatherCode = 0;

function isDaytime() {
    const hours = new Date().getHours();
    return hours >= 6 && hours < 18;
}

function checkDayNightTheme() {
    const weatherCard = document.getElementById('weather-widget');
    
    if (isDaytime()) {
        weatherCard.classList.add('day-mode');
        weatherCard.classList.remove('night-mode');
    } else {
        weatherCard.classList.add('night-mode');
        weatherCard.classList.remove('day-mode');
    }
    
    updateWeatherIcon(lastWeatherCode);
}

function updateWeatherIcon(code) {
    lastWeatherCode = code;
    const isDay = isDaytime();
    let iconClass = 'fa-cloud';

    if (code === 0) {
        iconClass = isDay ? 'fa-sun' : 'fa-moon';
    } else if (code >= 1 && code <= 3) {
        iconClass = isDay ? 'fa-cloud-sun' : 'fa-cloud-moon';
    } else if (code >= 45 && code <= 48) {
        iconClass = 'fa-smog';
    } else if (code >= 51 && code <= 67) {
        iconClass = 'fa-cloud-rain';
    } else if (code >= 71 && code <= 77) {
        iconClass = 'fa-snowflake';
    } else if (code >= 80 && code <= 82) {
        iconClass = 'fa-cloud-showers-heavy';
    } else if (code >= 95) {
        iconClass = 'fa-bolt';
    }

    const iconElement = document.getElementById('weather-icon');
    iconElement.className = `fa-solid ${iconClass}`;
}

async function fetchWeather(cityName) {
    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=hu`);
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
            alert('A megadott település nem található!');
            return;
        }

        const location = geoData.results[0];
        const lat = location.latitude;
        const lon = location.longitude;
        const displayName = location.name;

        const cacheBuster = `&_t=${new Date().getTime()}`;
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto${cacheBuster}`);
        const weatherData = await weatherRes.json();

        document.getElementById('city-name').textContent = displayName;
        document.getElementById('current-temp').textContent = Math.round(weatherData.current.temperature_2m);
        document.getElementById('temp-max').textContent = Math.round(weatherData.daily.temperature_2m_max[0]);
        document.getElementById('temp-min').textContent = Math.round(weatherData.daily.temperature_2m_min[0]);
        document.getElementById('precipitation').textContent = `${weatherData.current.precipitation} mm`;
        document.getElementById('wind-speed').textContent = `${Math.round(weatherData.current.wind_speed_10m)} km/h`;

        checkDayNightTheme();
        updateWeatherIcon(weatherData.current.weather_code);

        localStorage.setItem('selectedCity', displayName);

    } catch (error) {
        console.error('Hiba az időjárási adatok lekérésekor:', error);
    }
}

function openCitySelector(event) {
    event.stopPropagation();
    document.getElementById('city-overlay').style.display = 'flex';
}

function closeCitySelector() {
    document.getElementById('city-overlay').style.display = 'none';
}

function searchCity() {
    const input = document.getElementById('city-input');
    if (input.value.trim() !== '') {
        fetchWeather(input.value.trim());
        closeCitySelector();
        input.value = '';
    }
}

function handleCityKeyPress(event) {
    if (event.key === 'Enter') {
        searchCity();
    }
}

// --- Google Naptár Integráció (Mai és Holnapi teendők) ---
const GOOGLE_API_KEY = 'AIzaSyCePg1gAR4oxW2YfNh9VWFZigePMabxrG0';
const CALENDAR_ID = '21251052439dd05c95559932f6f01d81b2df212f34ecb5d04e8a4f92d02d2af5@group.calendar.google.com';

let cachedTodayEvents = [];
let cachedTomorrowEvents = [];

async function fetchGoogleCalendarEvents() {
    const listTodayEl = document.getElementById('tasks-list-today');
    const countTodayEl = document.getElementById('task-count-today');
    const listTomorrowEl = document.getElementById('tasks-list-tomorrow');
    const countTomorrowEl = document.getElementById('task-count-tomorrow');

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 0, 0, 0);

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?key=${GOOGLE_API_KEY}&timeMin=${startOfToday.toISOString()}&timeMax=${endOfTomorrow.toISOString()}&singleEvents=true&orderBy=startTime`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error('API hiba:', data.error.message);
            listTodayEl.innerHTML = '<div class="task-empty">Naptár hiba</div>';
            listTomorrowEl.innerHTML = '<div class="task-empty">Naptár hiba</div>';
            return;
        }

        const events = data.items || [];
        cachedTodayEvents = [];
        cachedTomorrowEvents = [];
        
        listTodayEl.innerHTML = '';
        listTomorrowEl.innerHTML = '';

        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const dayAfterTomorrowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);

        events.forEach(event => {
            let eventDate;
            if (event.start.dateTime) {
                eventDate = new Date(event.start.dateTime);
            } else if (event.start.date) {
                const parts = event.start.date.split('-');
                eventDate = new Date(parts[0], parts[1] - 1, parts[2]);
            }

            let timeStr = 'Egész nap';
            if (event.start.dateTime) {
                timeStr = eventDate.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
            }

            const eventObj = {
                summary: event.summary || 'Névtelen esemény',
                timeStr: timeStr
            };

            const item = document.createElement('div');
            item.className = 'task-item';
            item.innerHTML = `
                <span class="task-time">${timeStr}</span>
                <span class="task-title">${escapeHtml(eventObj.summary)}</span>
            `;

            if (eventDate >= todayMidnight && eventDate < tomorrowMidnight) {
                cachedTodayEvents.push(eventObj);
                listTodayEl.appendChild(item);
            } else if (eventDate >= tomorrowMidnight && eventDate < dayAfterTomorrowMidnight) {
                cachedTomorrowEvents.push(eventObj);
                listTomorrowEl.appendChild(item);
            }
        });

        countTodayEl.textContent = `${cachedTodayEvents.length} db`;
        countTomorrowEl.textContent = `${cachedTomorrowEvents.length} db`;

        if (cachedTodayEvents.length === 0) {
            listTodayEl.innerHTML = '<div class="task-empty">Nincs mára esemény</div>';
        }
        if (cachedTomorrowEvents.length === 0) {
            listTomorrowEl.innerHTML = '<div class="task-empty">Nincs holnapra esemény</div>';
        }

    } catch (error) {
        console.error('Hiba a Google Naptár lekérésekor:', error);
        listTodayEl.innerHTML = '<div class="task-empty">Sikertelen kapcsolódás</div>';
        listTomorrowEl.innerHTML = '<div class="task-empty">Sikertelen kapcsolódás</div>';
    }
}

// --- Hírek Modul (INDEX.HU RSS Feed API - 5 Szalagcím) ---
let cachedNews = [];

async function fetchNews() {
    const listEl = document.getElementById('news-list');
    const modalContentEl = document.getElementById('news-modal-content');
    
    const rssUrl = 'https://index.hu/24ora/rss/';
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

    try {
        const res = await fetch(apiUrl);
        const data = await res.json();

        if (data.status === 'ok' && data.items) {
            cachedNews = data.items.slice(0, 5);

            listEl.innerHTML = '';
            modalContentEl.innerHTML = '';

            cachedNews.forEach((item, index) => {
                const newsDiv = document.createElement('div');
                newsDiv.className = 'news-item-wide';
                newsDiv.textContent = item.title;
                listEl.appendChild(newsDiv);

                const modalDiv = document.createElement('div');
                modalDiv.className = 'news-modal-item';
                
                const cleanDescription = item.description ? item.description.replace(/<[^>]*>?/gm, '') : 'Nincs elérhető leírás.';
                
                modalDiv.innerHTML = `
                    <h4>${escapeHtml(item.title)}</h4>
                    <p>${escapeHtml(cleanDescription)}</p>
                `;
                modalContentEl.appendChild(modalDiv);
            });
        } else {
            listEl.innerHTML = '<div class="news-empty">Hírek nem érhetők el</div>';
        }
    } catch (error) {
        console.error('Hiba a hírek lekérésekor:', error);
        listEl.innerHTML = '<div class="news-empty">Sikertelen betöltés</div>';
    }
}

// --- Helyiségek Hőmérsékletének Lekérdezése ---
async function fetchRoomTemperatures() {
    try {
        // Ide jöhet majd a valós Wi-Fi szenzorok lekérdezése
    } catch (error) {
        console.error('Hiba a hőmérők olvasásakor:', error);
    }
}

// --- Web Speech API (Hangvezérlés) ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isVoiceActive = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'hu-HU';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = function(event) {
        const lastResultIndex = event.results.length - 1;
        const transcript = event.results[lastResultIndex][0].transcript.toLowerCase();
        console.log('Meghallott szöveg:', transcript);

        // Zenelejátszó & Lejátszási lista parancsok
        if (transcript.includes('zene indítás') || transcript.includes('lejátszás') || transcript.includes('zene start')) {
            controlSpotify('play');
            speakText('Zene elindítva.');
        } 
        else if (transcript.includes('zene állj') || transcript.includes('zene pauza') || transcript.includes('állítsd meg a zenét')) {
            controlSpotify('pause');
            speakText('Zene megállítva.');
        }
        else if (transcript.includes('chill zene') || transcript.includes('chill lista')) {
            switchPlaylist('3eiBcxJpxfbc4s7Qi9IXru', document.querySelectorAll('.playlist-btn')[0]);
            speakText('Chill lista kiválasztva.');
        }
        else if (transcript.includes('spa zene') || transcript.includes('spa lista')) {
            switchPlaylist('6Yyg1V5pohpj9CFY4OW2bX', document.querySelectorAll('.playlist-btn')[1]);
            speakText('Spa lista kiválasztva.');
        }
        else if (transcript.includes('lofi zene') || transcript.includes('lofi lista')) {
            switchPlaylist('37i9dQZF1DXkWgt9O6q3Il', document.querySelectorAll('.playlist-btn')[2]);
            speakText('Lofi lista kiválasztva.');
        }
        // Holnapi teendők
        else if (transcript.includes('holnapi teendő') || transcript.includes('holnapi naptár') || transcript.includes('holnapi feladat') || transcript.includes('mi lesz holnap')) {
            speakTomorrowTasks();
        } 
        // Mai teendők (vagy általános teendő kérés)
        else if (transcript.includes('mai teendő') || transcript.includes('mai naptár') || transcript.includes('mai feladat') || transcript.includes('mi van ma') || transcript.includes('teendő') || transcript.includes('naptár') || transcript.includes('feladat')) {
            speakTodayTasks();
        } 
        else if (transcript.includes('időjárás') || transcript.includes('idő') || transcript.includes('kint')) {
            speakWeather();
        } 
        else if (transcript.includes('nappali') || transcript.includes('hálószoba') || transcript.includes('vendégszoba') || transcript.includes('hőmérséklet') || transcript.includes('hány fok')) {
            speakTemperatures(transcript);
        }
        else if (transcript.includes('milyen nap') || transcript.includes('dátum') || transcript.includes('hányadika')) {
            speakDate();
        }
        else if (transcript.includes('hány óra') || transcript.includes('mennyi az idő') || transcript.includes('pontos idő')) {
            speakTime();
        }
        else if (transcript.includes('hír') || transcript.includes('hírek') || transcript.includes('újság')) {
            speakNews();
        }
    };

    recognition.onerror = function(event) {
        console.error('Beszédfelismerési hiba:', event.error);
    };

    recognition.onend = function() {
        if (isVoiceActive) {
            try {
                recognition.start();
            } catch (e) {
                console.log('Újraindítási hiba:', e);
            }
        }
    };
}

function controlSpotify(action) {
    const iframe = document.getElementById('spotify-player');
    if (!iframe) return;
    iframe.focus();
    if (action === 'play' || action === 'pause') {
        iframe.contentWindow.postMessage({ command: 'toggle' }, '*');
    }
}

function toggleVoiceControl() {
    if (!SpeechRecognition) {
        alert('A böngésződ nem támogatja a hangvezérlést. Használj Google Chrome-ot!');
        return;
    }

    const micBtn = document.getElementById('mic-btn');

    if (isVoiceActive) {
        isVoiceActive = false;
        recognition.stop();
        micBtn.classList.remove('listening');
        speakText('Hangvezérlés kikapcsolva.');
    } else {
        isVoiceActive = true;
        try {
            recognition.start();
            micBtn.classList.add('listening');
            speakText('Hallgatom a parancsokat.');
        } catch (e) {
            console.error(e);
        }
    }
}

function speakText(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'hu-HU';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

function speakTodayTasks() {
    if (cachedTodayEvents.length === 0) {
        speakText('A mai napra nincsenek események a naptárban.');
    } else {
        let speech = `A mai napra ${cachedTodayEvents.length} esemény van feljegyezve. `;
        cachedTodayEvents.forEach((ev, idx) => {
            speech += `${idx + 1}-es esemény: ${ev.summary}, időpont: ${ev.timeStr}. `;
        });
        speakText(speech);
    }
}

function speakTomorrowTasks() {
    if (cachedTomorrowEvents.length === 0) {
        speakText('A holnapi napra nincsenek események a naptárban.');
    } else {
        let speech = `A holnapi napra ${cachedTomorrowEvents.length} esemény van feljegyezve. `;
        cachedTomorrowEvents.forEach((ev, idx) => {
            speech += `${idx + 1}-es esemény: ${ev.summary}, időpont: ${ev.timeStr}. `;
        });
        speakText(speech);
    }
}

function speakWeather() {
    const city = document.getElementById('city-name').textContent;
    const temp = document.getElementById('current-temp').textContent;
    const precipitation = document.getElementById('precipitation').textContent;
    const wind = document.getElementById('wind-speed').textContent;

    if (temp === '--') {
        speakText('Az időjárási adatok még nem töltődtek be.');
    } else {
        speakText(`${city} településen jelenleg ${temp} fok van. A csapadék ${precipitation}, a szél sebessége ${wind}.`);
    }
}

function speakTemperatures(transcript) {
    const nappaliTemp = document.getElementById('temp-nappali').textContent;
    const haloTemp = document.getElementById('temp-haloszoba').textContent;
    const vendegTemp = document.getElementById('temp-vendegszoba').textContent;

    if (transcript.includes('nappali')) {
        speakText(`A nappaliban jelenleg ${nappaliTemp} van.`);
    } else if (transcript.includes('hálószoba')) {
        speakText(`A hálószobában jelenleg ${haloTemp} van.`);
    } else if (transcript.includes('vendégszoba')) {
        speakText(`A vendégszobában jelenleg ${vendegTemp} van.`);
    } else {
        speakText(`A hőmérsékletek: Nappali: ${nappaliTemp}, Hálószoba: ${haloTemp}, Vendégszoba: ${vendegTemp}.`);
    }
}

function speakDate() {
    const dateStr = document.getElementById('date').textContent;
    if (dateStr && !dateStr.includes('--')) {
        speakText(`Ma ${dateStr} van.`);
    } else {
        const now = new Date();
        let weekday = now.toLocaleDateString('hu-HU', { weekday: 'long' });
        speakText(`Ma ${now.getFullYear()} ${now.getMonth() + 1}. hó ${now.getDate()} nap, ${weekday} van.`);
    }
}

function speakTime() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    speakText(`A pontos idő ${hours} óra ${minutes} perc.`);
}

function speakNews() {
    if (cachedNews.length === 0) {
        speakText('A hírek jelenleg nem érhetők el.');
    } else {
        let speech = 'A legfrissebb hírek az Indexről: ';
        cachedNews.slice(0, 3).forEach((item, index) => {
            speech += `${index + 1}. hír: ${item.title}. `;
        });
        speakText(speech);
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// --- Animációk (Morphing) ---
let originalCardRect = null;

function expandLightsCard() {
    const triggerCard = document.getElementById('lights-trigger-card');
    const expandedCard = document.getElementById('expanded-card');
    const backdrop = document.getElementById('modal-backdrop');

    originalCardRect = triggerCard.getBoundingClientRect();

    expandedCard.style.top = `${originalCardRect.top}px`;
    expandedCard.style.left = `${originalCardRect.left}px`;
    expandedCard.style.width = `${originalCardRect.width}px`;
    expandedCard.style.height = `${originalCardRect.height}px`;

    triggerCard.classList.add('is-hidden');
    backdrop.classList.add('active');
    expandedCard.classList.add('active');

    requestAnimationFrame(() => {
        const targetWidth = Math.min(650, window.innerWidth - 40);
        const targetHeight = 360;
        const targetTop = (window.innerHeight - targetHeight) / 2;
        const targetLeft = (window.innerWidth - targetWidth) / 2;

        expandedCard.style.top = `${targetTop}px`;
        expandedCard.style.left = `${targetLeft}px`;
        expandedCard.style.width = `${targetWidth}px`;
        expandedCard.style.height = `${targetHeight}px`;
    });
}

function collapseLightsCard() {
    const triggerCard = document.getElementById('lights-trigger-card');
    const expandedCard = document.getElementById('expanded-card');
    const backdrop = document.getElementById('modal-backdrop');

    if (!originalCardRect) return;

    expandedCard.style.top = `${originalCardRect.top}px`;
    expandedCard.style.left = `${originalCardRect.left}px`;
    expandedCard.style.width = `${originalCardRect.width}px`;
    expandedCard.style.height = `${originalCardRect.height}px`;

    backdrop.classList.remove('active');
    expandedCard.classList.remove('active');

    setTimeout(() => {
        triggerCard.classList.remove('is-hidden');
    }, 400);
}

let originalNewsCardRect = null;

function expandNewsCard() {
    const triggerCard = document.getElementById('news-trigger-card');
    const expandedCard = document.getElementById('expanded-news-card');
    const backdrop = document.getElementById('modal-backdrop');

    originalNewsCardRect = triggerCard.getBoundingClientRect();

    expandedCard.style.top = `${originalNewsCardRect.top}px`;
    expandedCard.style.left = `${originalNewsCardRect.left}px`;
    expandedCard.style.width = `${originalNewsCardRect.width}px`;
    expandedCard.style.height = `${originalNewsCardRect.height}px`;

    triggerCard.classList.add('is-hidden');
    backdrop.classList.add('active');
    expandedCard.classList.add('active');

    requestAnimationFrame(() => {
        const targetWidth = Math.min(650, window.innerWidth - 40);
        const targetHeight = 360;
        const targetTop = (window.innerHeight - targetHeight) / 2;
        const targetLeft = (window.innerWidth - targetWidth) / 2;

        expandedCard.style.top = `${targetTop}px`;
        expandedCard.style.left = `${targetLeft}px`;
        expandedCard.style.width = `${targetWidth}px`;
        expandedCard.style.height = `${targetHeight}px`;
    });
}

function collapseNewsCard() {
    const triggerCard = document.getElementById('news-trigger-card');
    const expandedCard = document.getElementById('expanded-news-card');
    const backdrop = document.getElementById('modal-backdrop');

    if (!originalNewsCardRect) return;

    expandedCard.style.top = `${originalNewsCardRect.top}px`;
    expandedCard.style.left = `${originalNewsCardRect.left}px`;
    expandedCard.style.width = `${originalNewsCardRect.width}px`;
    expandedCard.style.height = `${originalNewsCardRect.height}px`;

    backdrop.classList.remove('active');
    expandedCard.classList.remove('active');

    setTimeout(() => {
        triggerCard.classList.remove('is-hidden');
    }, 400);
}

function toggleSubDevice(card) {
    card.classList.toggle('active');
    const statusText = card.querySelector('.sub-status');

    if (card.classList.contains('active')) {
        statusText.textContent = "Bekapcsolva";
    } else {
        statusText.textContent = "Kikapcsolva";
    }

    updateLightsSummary();
}

function updateLightsSummary() {
    const activeCards = document.querySelectorAll('.sub-device-card.active').length;
    const summaryText = document.getElementById('lights-summary-status');
    const triggerCard = document.getElementById('lights-trigger-card');

    if (activeCards === 0) {
        summaryText.textContent = "Minden lámpa lekapcsolva";
        triggerCard.classList.remove('active');
    } else {
        summaryText.textContent = `${activeCards} helyiségben ég`;
        triggerCard.classList.add('active');
    }
}

function updateDateTime() {
    const now = new Date();
    
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    let weekday = now.toLocaleDateString('hu-HU', { weekday: 'long' });
    weekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    
    document.getElementById('date').textContent = `${year}.${month}.${day}. ${weekday}`;

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    document.getElementById('clock').textContent = `${hours}:${minutes}`;

    checkDayNightTheme();
}

// --- Inicializálás és Automatikus Frissítés ---
updateDateTime();
setInterval(updateDateTime, 1000);

fetchWeather(currentCity);
fetchGoogleCalendarEvents();
fetchNews();
fetchRoomTemperatures();

// Naptár automatikus frissítése 5 másodpercenként
setInterval(fetchGoogleCalendarEvents, 1000);
// Hírek frissítése 15 percenként
setInterval(fetchNews, 900000);
// Hőmérséklet frissítése 10 másodpercenként
setInterval(fetchRoomTemperatures, 10000);
