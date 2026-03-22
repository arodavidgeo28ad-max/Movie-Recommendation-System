/**
 * CinemaIQ - Advanced Movie Intelligence
 * Modular Netflix-style Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    const State = {
        allMovies: [],
        filteredMovies: [],
        watchlist: JSON.parse(localStorage.getItem('cinemaIQ_watchlist') || '[]'),
        genres: [],
        currentSection: 'home',
        isLoaded: false,
        charts: {}
    };

    // --- DOM ELEMENTS ---
    const els = {
        // Navigation
        navItems: document.querySelectorAll('.nav-menu li'),
        sections: document.querySelectorAll('.view-section'),

        // Search & Recommendations
        searchInput: document.getElementById('movie-search'),
        suggestions: document.getElementById('search-suggestions'),
        recommendBtn: document.getElementById('recommend-btn'),
        surpriseBtn: document.getElementById('surprise-btn'),

        // Grids
        homeRecGrid: document.getElementById('home-recommendations'),
        homeTrendingGrid: document.getElementById('home-trending'),
        recGrid: document.getElementById('recommended-grid'),
        discoverGrid: document.getElementById('discover-grid'),
        watchlistGrid: document.getElementById('watchlist-grid'),

        // Hero
        heroBanner: document.getElementById('hero-banner'),
        heroTitle: document.getElementById('hero-title'),
        heroDesc: document.getElementById('hero-desc'),
        heroMeta: document.querySelector('.hero-meta'),

        // Modal
        modal: document.getElementById('movie-modal'),
        closeModal: document.getElementById('close-modal'),
        mPoster: document.getElementById('modal-poster'),
        mTitle: document.getElementById('modal-title'),
        mRating: document.getElementById('modal-rating'),
        mYear: document.getElementById('modal-year'),
        mGenre: document.getElementById('modal-genre'),
        mDesc: document.getElementById('modal-desc'),
        mCast: document.getElementById('modal-cast'),
        mAddWatchlist: document.getElementById('modal-add-watchlist'),
        mRecSimilar: document.getElementById('modal-recommend-similar'),
        mSimilarGrid: document.getElementById('modal-similar-grid'),

        // Filters
        genreFilter: document.getElementById('genre-filter'),
        ratingFilter: document.getElementById('rating-filter'),
        yearFilter: document.getElementById('year-filter'),
        moodChips: document.querySelectorAll('.mood-chip'),

        // Analytics
        statTotalM: document.getElementById('stat-total-movies'),
        statTotalG: document.getElementById('stat-total-genres'),
        statAvgR: document.getElementById('stat-avg-rating'),
        status: document.getElementById('dataset-status'),
        voiceBtn: document.getElementById('voice-search-btn')
    };

    // --- INITIALIZATION ---
    async function init() {
        showStatus('Initializing Engine...', 'loading');

        if (typeof rawMovieData !== 'undefined') {
            processData(rawMovieData);
        } else {
            showStatus('Dataset missing!', 'error');
            return;
        }

        setupEventListeners();
        renderHome();
        updateAnalytics();
        loadWatchlist();

        State.isLoaded = true;
        showStatus('Engine Ready', 'ready');
        setTimeout(() => els.status.parentElement.style.opacity = '0.5', 3000);
    }

    // --- DATA PROCESSING ---
    function processData(data) {
        const genreSet = new Set();

        State.allMovies = data.map(m => {
            const genres = m.g || "";
            genres.split(',').forEach(g => {
                const trimmed = g.trim();
                if (trimmed) genreSet.add(trimmed);
            });

            return {
                id: m.i,
                title: m.t,
                genres: genres,
                rating: m.r || 0,
                voteCount: m.c || 0,
                desc: m.o || "No overview available.",
                year: m.d || "N/A",
                popularity: m.p || 0,
                cast: m.a || "Unknown",
                keywords: m.k || ""
            };
        });

        State.genres = Array.from(genreSet).sort();
        populateFilters();
    }

    function populateFilters() {
        State.genres.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = g;
            els.genreFilter.appendChild(opt);
        });
    }

    // --- UI CONTROLLER ---
    function setupEventListeners() {
        // Sidebar Navigation
        els.navItems.forEach(item => {
            item.addEventListener('click', () => {
                const section = item.getAttribute('data-section');
                switchSection(section);
            });
        });

        // Search Input
        els.searchInput.addEventListener('input', debounce(handleSearch, 300));
        els.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = els.searchInput.value.trim();
                if (val) doRecommendation(val);
            }
        });

        // Recommendation Actions
        els.recommendBtn.addEventListener('click', () => {
            const val = els.searchInput.value.trim();
            if (val) doRecommendation(val);
        });

        els.surpriseBtn.addEventListener('click', () => {
            const randomMovie = State.allMovies[Math.floor(Math.random() * State.allMovies.length)];
            openModal(randomMovie);
        });

        // Modal Hooks
        els.closeModal.addEventListener('click', closeModal);
        window.addEventListener('click', (e) => {
            if (e.target === els.modal) closeModal();
        });

        // Filter Hooks
        els.genreFilter.addEventListener('change', applyFilters);
        els.ratingFilter.addEventListener('change', applyFilters);
        els.yearFilter.addEventListener('change', applyFilters);

        // Mood Chips
        els.moodChips.forEach(chip => {
            chip.addEventListener('click', () => {
                els.moodChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                handleMood(chip.getAttribute('data-mood'));
            });
        });

        // Voice Search
        if (els.voiceBtn) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.lang = 'en-US';

                els.voiceBtn.addEventListener('click', () => {
                    recognition.start();
                    els.voiceBtn.classList.add('listening');
                });

                recognition.onresult = (e) => {
                    const transcript = e.results[0][0].transcript;
                    els.searchInput.value = transcript;
                    els.voiceBtn.classList.remove('listening');
                    doRecommendation(transcript);
                };

                recognition.onerror = () => els.voiceBtn.classList.remove('listening');
                recognition.onend = () => els.voiceBtn.classList.remove('listening');
            } else {
                els.voiceBtn.style.display = 'none';
            }
        }

        // Navigation Links in sections
        document.querySelectorAll('.sec-link').forEach(link => {
            link.addEventListener('click', () => {
                switchSection(link.getAttribute('data-section'));
            });
        });
    }

    function switchSection(sectionId) {
        if (State.currentSection === sectionId) return;

        State.currentSection = sectionId;

        // Nav UI
        els.navItems.forEach(nav => {
            nav.classList.toggle('active', nav.getAttribute('data-section') === sectionId);
        });

        // Section UI
        els.sections.forEach(sec => {
            sec.classList.toggle('active', sec.id === `sec-${sectionId}`);
        });

        if (sectionId === 'analytics') renderCharts();
        if (sectionId === 'watchlist') renderWatchlist();
        if (sectionId === 'trending') renderTrending();
        if (sectionId === 'genres') applyFilters(); // Initial render for all
        if (sectionId === 'recommendations') {
            const currentRecContext = document.getElementById('recommendation-context');
            if (!currentRecContext.innerHTML) {
                currentRecContext.innerHTML = `<span>Personalized Highlights</span> for you`;
                const topRated = [...State.allMovies].sort((a, b) => b.rating - a.rating).slice(0, 20);
                renderGrid(els.recGrid, topRated);
            }
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderTrending() {
        const trendingGrid = document.getElementById('full-trending-grid');
        if (!trendingGrid) return;
        const trending = [...State.allMovies].sort((a, b) => b.popularity - a.popularity).slice(0, 30);
        renderGrid(trendingGrid, trending);
    }

    // --- CORE LOGIC ---
    function renderHome() {
        // Hero: Pick a high-rated popular movie
        const topPicks = State.allMovies.filter(m => m.rating > 8 && m.popularity > 50);
        const featured = topPicks[Math.floor(Math.random() * topPicks.length)] || State.allMovies[0];
        updateHero(featured);

        // Trending Row
        const trending = [...State.allMovies].sort((a, b) => b.popularity - a.popularity).slice(0, 10);
        renderGrid(els.homeTrendingGrid, trending);

        // Recommended Row (Initial random high rated)
        const recs = State.allMovies.filter(m => m.rating > 7.5).sort(() => 0.5 - Math.random()).slice(0, 10);
        renderGrid(els.homeRecGrid, recs);
    }

    function updateHero(movie) {
        els.heroTitle.textContent = movie.title;
        els.heroDesc.textContent = movie.desc;
        els.heroMeta.innerHTML = `
            <span class="rating">⭐ ${movie.rating}</span>
            <span class="year">${movie.year}</span>
            <span class="genre">${movie.genres.split(',').slice(0, 2).join(', ')}</span>
        `;

        // Placeholder background for hero
        els.heroBanner.style.backgroundImage = `linear-gradient(to right, rgba(0,0,0,0.8) 0%, transparent 60%), url('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1500&q=80')`;

        document.getElementById('hero-play').onclick = () => openModal(movie);
    }

    function renderGrid(container, movies) {
        container.innerHTML = '';
        movies.forEach(m => {
            container.appendChild(createCard(m));
        });
    }

    function createCard(movie) {
        const card = document.createElement('div');
        card.className = 'movie-card';

        const posterKey = `poster_${movie.id}`;
        let cachedPoster = sessionStorage.getItem(posterKey);

        const firstGenre = movie.genres.split(',')[0].trim();
        const genreClassMap = {
            'Action': 'bg-action', 'Adventure': 'bg-adventure', 'Animation': 'bg-animation',
            'Comedy': 'bg-comedy', 'Crime': 'bg-crime', 'Drama': 'bg-drama',
            'Fantasy': 'bg-fantasy', 'Horror': 'bg-horror', 'Science Fiction': 'bg-scifi',
            'Thriller': 'bg-thriller', 'Mystery': 'bg-crime', 'Romance': 'bg-drama',
            'Family': 'bg-animation', 'Music': 'bg-drama', 'History': 'bg-drama',
            'War': 'bg-action', 'Western': 'bg-action', 'Documentary': 'bg-default'
        };
        const genreClass = genreClassMap[firstGenre] || 'bg-default';

        const emojiMap = {
            'Action': '⚔️', 'Adventure': '🌍', 'Animation': '🎨', 'Comedy': '😂', 'Crime': '🕵️',
            'Drama': '🎭', 'Fantasy': '🔮', 'Horror': '👻', 'Science Fiction': '🚀', 'Thriller': '😰',
            'Mystery': '🔍', 'Romance': '💖', 'Family': '👨‍👩‍👧‍👦', 'Music': '🎵', 'History': '📚',
            'War': '🛡️', 'Western': '🤠', 'Documentary': '📽️'
        };
        const emoji = emojiMap[firstGenre] || '🎬';

        card.innerHTML = `
            <div class="card-bg-placeholder ${genreClass}">
                <img class="card-img" src="${cachedPoster || ''}" 
                     style="${cachedPoster ? 'display:block' : 'display:none'}" 
                     alt="${movie.title}"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div class="card-icon" style="${cachedPoster ? 'display:none' : 'display:block'}">${emoji}</div>
            </div>
            <div class="card-info">
                <h4 class="card-title">${movie.title}</h4>
                <div class="card-meta">
                    <span>${firstGenre} • ${movie.year}</span>
                    <span class="rating">⭐ ${movie.rating}</span>
                </div>
            </div>
        `;

        card.addEventListener('click', () => openModal(movie));
        return card;
    }

    // --- RECOMMENDATION ENGINE ---
    function doRecommendation(title) {
        const query = title.toLowerCase().trim();
        // Priority: Exact Match > Starts With > Includes
        let matches = State.allMovies.filter(m => m.title.toLowerCase().includes(query));
        
        if (matches.length === 0) {
            alert("Movie not found in our database!");
            return;
        }

        const target = matches.find(m => m.title.toLowerCase() === query) || 
                       matches.find(m => m.title.toLowerCase().startsWith(query)) || 
                       matches[0];

        console.log(`Searching for: ${query} | Found target: ${target.title}`);

        switchSection('recommendations');
        document.getElementById('recommendation-context').innerHTML = `Because you watched <span>${target.title}</span>`;

        const recommendations = State.allMovies
            .filter(m => m.id !== target.id)
            .map(m => ({
                movie: m,
                score: calculateHybridScore(target, m)
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 40)
            .map(i => i.movie);

        const finalResults = [target, ...recommendations];
        console.log(`Rendering ${finalResults.length} movies. First is ${finalResults[0].title}`);
        renderGrid(els.recGrid, finalResults);
    }

    function calculateHybridScore(target, movie) {
        // Similarity Score (Genres & Keywords)
        const tGenres = target.genres.split(',').map(g => g.trim());
        const mGenres = movie.genres.split(',').map(g => g.trim());
        const commonGenres = tGenres.filter(g => mGenres.includes(g)).length;

        const simScore = (commonGenres / Math.max(tGenres.length, 1)) * 10;

        // Hybrid weighting
        let score = (simScore * 0.4) +
            (movie.rating * 0.3) +
            ((movie.popularity / 100) * 0.2) +
            ((parseInt(movie.year) / 2024 || 0) * 0.1);

        // EXTRA BOOST for matching title substrings (Sequels/Franchises)
        const targetMainTitle = target.title.split(':')[0].split(' - ')[0].trim();
        if (movie.title.toLowerCase().includes(targetMainTitle.toLowerCase())) {
            score += 20; // Massive boost for direct sequels/prequels
        }

        // Thematic Boost (Series/Franchise names from common keywords)
        const thematicKeywords = ['Marvel', 'Spider-Man', 'Spider-man', 'Avengers', 'Batman', 'Bond', 'Star Wars', 'Harry Potter', 'Pixar', 'Disney', 'DC Comics'];
        thematicKeywords.forEach(kw => {
            const lowKW = kw.toLowerCase();
            if (target.title.toLowerCase().includes(lowKW) || target.keywords.toLowerCase().includes(lowKW)) {
                if (movie.title.toLowerCase().includes(lowKW) || movie.keywords.toLowerCase().includes(lowKW)) {
                    score += 15; // Significant boost for franchise consistency
                }
            }
        });

        return score;
    }

    function handleMood(mood) {
        const moodMap = {
            'happy': ['Animation', 'Comedy', 'Family'],
            'thriller': ['Thriller', 'Crime', 'Horror'],
            'mind-bending': ['Science Fiction', 'Mystery', 'Thriller'],
            'romantic': ['Romance', 'Drama'],
            'adventure': ['Adventure', 'Action', 'Fantasy']
        };

        const targetGenres = moodMap[mood] || [];
        const filtered = State.allMovies
            .filter(m => targetGenres.some(g => m.genres.includes(g)))
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 10);

        renderGrid(els.homeRecGrid, filtered);
        document.getElementById('home-recommendations').scrollIntoView({ behavior: 'smooth' });
    }

    // --- SEARCH ---
    function handleSearch() {
        const query = els.searchInput.value.toLowerCase().trim();
        if (query.length < 2) {
            els.suggestions.classList.add('hidden');
            return;
        }

        const matches = State.allMovies
            .filter(m => m.title.toLowerCase().includes(query) || m.genres.toLowerCase().includes(query))
            .slice(0, 6);

        if (matches.length > 0) {
            els.suggestions.innerHTML = '';
            matches.forEach(m => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.innerHTML = `
                    <div style="width: 30px; height: 40px; background: #333; border-radius: 4px; flex-shrink: 0;"></div>
                    <div>
                        <div style="font-weight: 600;">${m.title}</div>
                        <div style="font-size: 0.75rem; color: #888;">${m.year} • ${m.genres.split(',')[0]}</div>
                    </div>
                `;
                item.onclick = () => {
                    els.searchInput.value = m.title;
                    els.suggestions.classList.add('hidden');
                    doRecommendation(m.title);
                };
                els.suggestions.appendChild(item);
            });
            els.suggestions.classList.remove('hidden');
        } else {
            els.suggestions.classList.add('hidden');
        }
    }

    // --- FILTERS ---
    function applyFilters() {
        const gVal = els.genreFilter.value;
        const rVal = parseFloat(els.ratingFilter.value);
        const yVal = els.yearFilter.value;

        let filtered = [...State.allMovies];

        if (gVal) filtered = filtered.filter(m => m.genres.includes(gVal));
        if (rVal) filtered = filtered.filter(m => m.rating >= rVal);
        if (yVal) {
            if (yVal === '2020') filtered = filtered.filter(m => parseInt(m.year) >= 2020);
            else if (yVal === '2010') filtered = filtered.filter(m => parseInt(m.year) >= 2010 && parseInt(m.year) < 2020);
            else if (yVal === '2000') filtered = filtered.filter(m => parseInt(m.year) >= 2000 && parseInt(m.year) < 2010);
            else if (yVal === '1990') filtered = filtered.filter(m => parseInt(m.year) >= 1990 && parseInt(m.year) < 2000);
        }

        renderGrid(els.discoverGrid, filtered.slice(0, 40));
    }

    // --- MODAL ---
    function openModal(movie) {
        els.mTitle.textContent = movie.title;
        els.mRating.textContent = `⭐ ${movie.rating}`;
        els.mYear.textContent = movie.year;
        els.mGenre.textContent = movie.genres;
        els.mDesc.textContent = movie.desc;
        els.mCast.textContent = movie.cast;

        // Watchlist Button State
        const inWatchlist = State.watchlist.some(m => m.id === movie.id);
        els.mAddWatchlist.innerHTML = inWatchlist ? '➖ Remove from List' : '➕ My List';
        els.mAddWatchlist.onclick = () => toggleWatchlist(movie);

        els.mRecSimilar.onclick = () => {
            closeModal();
            doRecommendation(movie.title);
        };

        // Similar Mini Grid
        const similar = State.allMovies
            .filter(m => m.id !== movie.id && m.genres.includes(movie.genres.split(',')[0]))
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 4);
        renderGrid(els.mSimilarGrid, similar);

        els.modal.classList.remove('hidden');
    }

    function closeModal() {
        els.modal.classList.add('hidden');
    }

    // --- WATCHLIST ---
    function toggleWatchlist(movie) {
        const idx = State.watchlist.findIndex(m => m.id === movie.id);
        if (idx > -1) {
            State.watchlist.splice(idx, 1);
        } else {
            State.watchlist.push(movie);
        }
        localStorage.setItem('cinemaIQ_watchlist', JSON.stringify(State.watchlist));

        // Update UI
        els.mAddWatchlist.innerHTML = idx > -1 ? '➕ My List' : '➖ Remove from List';
        if (State.currentSection === 'watchlist') renderWatchlist();
    }

    function renderWatchlist() {
        if (State.watchlist.length === 0) {
            els.watchlistGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: #555;">Your watchlist is empty. Start exploring to add movies!</div>`;
            return;
        }
        renderGrid(els.watchlistGrid, State.watchlist);
    }

    function loadWatchlist() {
        // Just sync from LS on init
        State.watchlist = JSON.parse(localStorage.getItem('cinemaIQ_watchlist') || '[]');
    }

    // --- ANALYTICS ---
    function updateAnalytics() {
        els.statTotalM.textContent = State.allMovies.length.toLocaleString();
        els.statTotalG.textContent = State.genres.length;
        const avg = State.allMovies.reduce((a, b) => a + b.rating, 0) / State.allMovies.length;
        els.statAvgR.textContent = avg.toFixed(1);
    }

    function renderCharts() {
        if (typeof Chart === 'undefined') {
            console.error('Chart.js not loaded!');
            return;
        }

        const canvasGenre = document.getElementById('genreChart');
        const canvasRating = document.getElementById('ratingChart');
        if (!canvasGenre || !canvasRating) return;

        const ctxGenre = canvasGenre.getContext('2d');
        const ctxRating = canvasRating.getContext('2d');

        if (State.charts.genre) State.charts.genre.destroy();
        if (State.charts.rating) State.charts.rating.destroy();

        try {
            // Genre Distribution
            const genreData = State.genres.slice(0, 10).map(g => {
                return {
                    label: g,
                    count: State.allMovies.filter(m => m.genres.includes(g)).length
                };
            }).sort((a, b) => b.count - a.count);

            State.charts.genre = new Chart(ctxGenre, {
                type: 'bar',
                data: {
                    labels: genreData.map(d => d.label),
                    datasets: [{
                        label: 'Movies by Genre',
                        data: genreData.map(d => d.count),
                        backgroundColor: 'rgba(197, 160, 89, 0.65)', /* Softer Gold */
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { backgroundColor: 'rgba(17, 18, 22, 0.9)', titleColor: '#c5a059' }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255,255,255,0.03)' },
                            ticks: { color: '#8e8e93' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#8e8e93' }
                        }
                    }
                }
            });

            // Rating Density
            const ratingsArr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(r => {
                return State.allMovies.filter(m => Math.floor(m.rating) === r).length;
            });

            State.charts.rating = new Chart(ctxRating, {
                type: 'line',
                data: {
                    labels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                    datasets: [{
                        label: 'Rating Distribution',
                        data: ratingsArr,
                        borderColor: 'rgba(30, 58, 138, 0.8)', /* Premium Navy */
                        borderWidth: 3,
                        pointBackgroundColor: '#c5a059',
                        tension: 0.4,
                        fill: true,
                        backgroundColor: 'rgba(30, 58, 138, 0.05)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { backgroundColor: 'rgba(17, 18, 22, 0.9)', titleColor: '#c5a059' }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255,255,255,0.03)' },
                            ticks: { color: '#8e8e93' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#8e8e93' }
                        }
                    }
                }
            });
        } catch (e) {
            console.error('Chart rendering failed:', e);
        }
    }

    // --- UTILS ---
    function showStatus(msg, type) {
        els.status.textContent = msg;
        els.status.className = `status-${type}`;
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Kickoff
    init();
});
