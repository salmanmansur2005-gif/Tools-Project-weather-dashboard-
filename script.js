const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const locationBtn = document.getElementById("locationBtn");
const unitToggleBtn = document.getElementById("unitToggleBtn");
const weatherDisplay = document.getElementById("weatherDisplay");
const skeletonLoader = document.getElementById("skeletonLoader");
const errorMsg = document.getElementById("errorMsg");
const historyContainer = document.getElementById("historyContainer");
const cityName = document.getElementById("cityName");
const weatherDesc = document.getElementById("weatherDesc");
const weatherIcon = document.getElementById("weatherIcon");
const temp = document.getElementById("temp");
const humidity = document.getElementById("humidity");
const windSpeed = document.getElementById("windSpeed");
const aqi = document.getElementById("aqi");
const localTime = document.getElementById("localTime");
const forecastContainer = document.getElementById("forecastContainer");
const mainBody = document.getElementById("mainBody");

let currentUnit = 'C'; 
let lastWeatherData = null; 
let searchHistory = JSON.parse(localStorage.getItem("weatherHistory")) || [];

renderHistory();

searchBtn.addEventListener("click", () => {
    const city = cityInput.value.trim();
    if (city) fetchWeatherDataByCity(city);
});

cityInput.addEventListener("keypress", (e) => {
    if (e.key === 'Enter') {
        const city = cityInput.value.trim();
        if (city) fetchWeatherDataByCity(city);
    }
});

locationBtn.addEventListener("click", () => {
    if (navigator.geolocation) {
        showSkeleton(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                fetchWeatherByCoords(latitude, longitude, "Current Location 📍");
            },
            () => {
                showSkeleton(false);
                showError("Unable to retrieve your GPS location.");
            }
        );
    } else {
        showError("Geolocation is not supported by your browser.");
    }
});

unitToggleBtn.addEventListener("click", () => {
    currentUnit = currentUnit === 'C' ? 'F' : 'C';
    unitToggleBtn.textContent = `°${currentUnit}`;
    if (lastWeatherData) {
        updateTemperatureDisplay(lastWeatherData.currentTemp);
        updateForecastDisplay(lastWeatherData.dailyData);
    }
});

function showSkeleton(show) {
    if (show) {
        skeletonLoader.classList.remove("hidden");
        weatherDisplay.classList.add("hidden");
        errorMsg.classList.add("hidden");
    } else {
        skeletonLoader.classList.add("hidden");
    }
}

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove("hidden");
    weatherDisplay.classList.add("hidden");
}

async function fetchWeatherDataByCity(city) {
    showSkeleton(true);
    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
        const geoData = await geoRes.json();
        if (!geoData.results || geoData.results.length === 0) {
            throw new Error("City not found");
        }
        const { latitude, longitude, name, country } = geoData.results[0];
        await fetchWeatherByCoords(latitude, longitude, `${name}, ${country || ''}`);
        addToHistory(name);
    } catch (error) {
        showSkeleton(false);
        showError("City not found. Please try a valid name.");
    }
}

async function fetchWeatherByCoords(lat, lon, displayName) {
    showSkeleton(true);
    try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=6&timezone=auto`;
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`;
        const [weatherRes, aqiRes] = await Promise.all([
            fetch(weatherUrl),
            fetch(aqiUrl).catch(() => null)
        ]);
        const weatherData = await weatherRes.json();
        const aqiData = aqiRes ? await aqiRes.json() : null;

        lastWeatherData = {
            currentTemp: weatherData.current.temperature_2m,
            dailyData: weatherData.daily
        };

        cityName.textContent = displayName;
        
        if (weatherData.timezone) {
            const timeStr = new Date().toLocaleTimeString('en-US', { timeZone: weatherData.timezone, hour: '2-digit', minute: '2-digit' });
            const dateStr = new Date().toLocaleDateString('en-US', { timeZone: weatherData.timezone, weekday: 'short', month: 'short', day: 'numeric' });
            localTime.textContent = `${dateStr} • ${timeStr}`;
        } else {
            localTime.textContent = new Date().toLocaleString();
        }

        humidity.textContent = `${weatherData.current.relative_humidity_2m}%`;
        windSpeed.textContent = `${weatherData.current.wind_speed_10m} km/h`;

        if (aqiData && aqiData.current && aqiData.current.european_aqi !== undefined) {
            const val = aqiData.current.european_aqi;
            aqi.textContent = `${val} (${getAqiText(val)})`;
        } else {
            aqi.textContent = "N/A";
        }

        const wCode = weatherData.current.weather_code;
        const info = getWeatherInfo(wCode);
        weatherDesc.textContent = info.text;
        weatherIcon.textContent = info.icon;
        
        updateBackgroundClass(wCode);

        updateTemperatureDisplay(weatherData.current.temperature_2m);
        updateForecastDisplay(weatherData.daily);

        showSkeleton(false);
        weatherDisplay.classList.remove("hidden");
    } catch (err) {
        showSkeleton(false);
        showError("Failed to fetch weather data. Check your internet connection.");
    }
}

function updateTemperatureDisplay(tempC) {
    let t = tempC;
    let unitSymbol = '°C';
    if (currentUnit === 'F') {
        t = (tempC * 9/5) + 32;
        unitSymbol = '°F';
    }
    temp.textContent = `${Math.round(t)}${unitSymbol}`;
}

function updateForecastDisplay(daily) {
    if (!daily || !daily.time) return;
    forecastContainer.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        if (!daily.time[i]) break;
        const dateObj = new Date(daily.time[i]);
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        let maxT = daily.temperature_2m_max[i];
        let minT = daily.temperature_2m_min[i];
        if (currentUnit === 'F') {
            maxT = (maxT * 9/5) + 32;
            minT = (minT * 9/5) + 32;
        }
        const info = getWeatherInfo(daily.weather_code[i]);
        const card = document.createElement('div');
        card.className = "bg-white/10 p-2 rounded-lg flex flex-col items-center justify-center border border-white/10";
        card.innerHTML = `
            <p class="text-xs text-white/80 font-medium">${dayName}</p>
            <span class="text-xl my-1">${info.icon}</span>
            <p class="text-xs font-bold">${Math.round(maxT)}°/<span class="text-white/60">${Math.round(minT)}°</span></p>
        `;
        forecastContainer.appendChild(card);
    }
}

function getWeatherInfo(code) {
    if (code === 0) return { text: "Clear Sky", icon: "☀️" };
    if (code <= 3) return { text: "Partly Cloudy", icon: "⛅" };
    if (code <= 48) return { text: "Foggy / Hazy", icon: "🌫️" };
    if (code <= 67) return { text: "Rain Showers", icon: "🌧️" };
    if (code <= 77) return { text: "Snowy", icon: "❄️" };
    return { text: "Thunderstorm", icon: "⚡" };
}

function getAqiText(aqiVal) {
    if (aqiVal <= 20) return "Good 🟢";
    if (aqiVal <= 40) return "Fair 🟡";
    if (aqiVal <= 60) return "Moderate 🟠";
    if (aqiVal <= 80) return "Poor 🔴";
    return "Very Poor 🟣";
}

function updateBackgroundClass(code) {
    mainBody.classList.remove('bg-clear', 'bg-cloudy', 'bg-rainy', 'bg-storm');
    if (code === 0) {
        mainBody.classList.add('bg-clear');
    } else if (code <= 3) {
        mainBody.classList.add('bg-cloudy');
    } else if (code <= 67) {
        mainBody.classList.add('bg-rainy');
    } else {
        mainBody.classList.add('bg-storm');
    }
}

function addToHistory(city) {
    if (!searchHistory.includes(city)) {
        searchHistory.unshift(city);
        if (searchHistory.length > 5) searchHistory.pop();
        localStorage.setItem("weatherHistory", JSON.stringify(searchHistory));
        renderHistory();
    }
}

function renderHistory() {
    historyContainer.innerHTML = '';
    searchHistory.forEach(city => {
        const btn = document.createElement('button');
        btn.className = "px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-xs font-medium transition whitespace-nowrap border border-white/10";
        btn.textContent = city;
        btn.addEventListener('click', () => {
            cityInput.value = city;
            fetchWeatherDataByCity(city);
        });
        historyContainer.appendChild(btn);
    });
}