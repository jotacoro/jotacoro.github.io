const players = document.querySelectorAll('.player__wrapper');

initializePlayers(players);

function initializePlayers(players) {
    const instances = [];
    const playIcon = '<i class="fa-solid fa-play"></i>';
    const pauseIcon = '<i class="fa-solid fa-pause"></i>';
    const loadingIcon = '<i class="fa-solid fa-spinner"></i>';

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    let sharedContext = null;

    function getSharedContext() {
        if (!AudioContextCtor) {
            return null;
        }
        if (!sharedContext) {
            sharedContext = new AudioContextCtor();
        }
        return sharedContext;
    }

    players.forEach((player) => {
        const playButton = player.querySelector('.play__button');
        const previousButton = player.querySelector('.previous__button');
        const nextButton = player.querySelector('.next__button');
        const progress = player.querySelector('.progress');
        const progressFill = player.querySelector('.progress__fill');
        const versionText = player.querySelector('.player__version');
        const overlay = player.querySelector('.player__overlay');

        if (!playButton || !previousButton || !nextButton || !progress || !progressFill) {
            return;
        }

        const versions = [
            {
                src: player.getAttribute('data-audio-a'),
                label: player.getAttribute('data-version-a'),
                tooltip: player.getAttribute('data-tooltip-a'),
            },
            {
                src: player.getAttribute('data-audio-b'),
                label: player.getAttribute('data-version-b'),
                tooltip: player.getAttribute('data-tooltip-b'),
            },
            {
                src: player.getAttribute('data-audio-c'),
                label: player.getAttribute('data-version-c'),
                tooltip: player.getAttribute('data-tooltip-c'),
            },
        ].map((version) => ({
            ...version,
            buffer: null,
            decodePromise: null,
            source: null,
            gain: null,
        }));

        let currentVersionIndex = 0;
        let hasStarted = false;
        let isPlaying = false;
        let isLoading = false;
        let hasCompletedPlayback = false;
        let animationFrameId = null;
        let playRequestId = 0;

        // Playback time tracking
        let baseOffset = 0;          // offset (in seconds) at which current sources were started
        let startedAtCtxTime = 0;    // AudioContext.currentTime when sources started
        let sourcesActive = false;   // whether running source nodes exist

        const instance = {
            pauseFromOutside() {
                pauseCurrentAudio();
                updatePlayerState();
            },
        };
        instances.push(instance);

        previousButton.disabled = true;
        nextButton.disabled = true;
        playButton.disabled = false;
        updatePlayerState();

        playButton.addEventListener('click', () => {
            if (isPlaying || isLoading) {
                pauseCurrentAudio();
                updatePlayerState();
                return;
            }
            playCurrentVersion();
        });

        previousButton.addEventListener('click', () => {
            if (hasCompletedPlayback) {
                hasCompletedPlayback = false;
                seekTo(0);
                return;
            }
            switchVersion(-1);
        });

        nextButton.addEventListener('click', () => {
            hasCompletedPlayback = false;
            switchVersion(1);
        });

        progress.addEventListener('click', (event) => {
            if (!hasStarted) {
                return;
            }
            const duration = getActiveDuration();
            if (!Number.isFinite(duration) || duration <= 0) {
                return;
            }
            const rect = progress.getBoundingClientRect();
            const percentage = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
            hasCompletedPlayback = false;
            seekTo(percentage * duration);
        });

        function getActiveVersion() {
            return versions[currentVersionIndex];
        }

        function getActiveDuration() {
            const buf = getActiveVersion().buffer;
            return buf ? buf.duration : NaN;
        }

        function getCurrentPlaybackTime() {
            const ctx = sharedContext;
            if (sourcesActive && isPlaying && ctx) {
                const t = baseOffset + (ctx.currentTime - startedAtCtxTime);
                const duration = getActiveDuration();
                if (Number.isFinite(duration) && duration > 0) {
                    return Math.min(t, duration);
                }
                return t;
            }
            return baseOffset;
        }

        function fetchAndDecode(version) {
            if (version.buffer) {
                return Promise.resolve(version.buffer);
            }
            if (version.decodePromise) {
                return version.decodePromise;
            }
            const ctx = getSharedContext();
            if (!ctx) {
                return Promise.reject(new Error('Web Audio API not supported'));
            }
            version.decodePromise = fetch(version.src)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch audio: ${response.status}`);
                    }
                    return response.arrayBuffer();
                })
                .then((arrayBuffer) => new Promise((resolve, reject) => {
                    // Use callback form for Safari compatibility; some versions
                    // do not return a Promise from decodeAudioData.
                    try {
                        const maybePromise = ctx.decodeAudioData(arrayBuffer, resolve, reject);
                        if (maybePromise && typeof maybePromise.then === 'function') {
                            maybePromise.then(resolve, reject);
                        }
                    } catch (err) {
                        reject(err);
                    }
                }))
                .then((buffer) => {
                    version.buffer = buffer;
                    return buffer;
                })
                .catch((err) => {
                    version.decodePromise = null;
                    throw err;
                });
            return version.decodePromise;
        }

        function ensureAllDecoded() {
            return Promise.all(versions.map((v) => fetchAndDecode(v)));
        }

        function stopSources() {
            versions.forEach((v) => {
                if (v.source) {
                    try {
                        v.source.onended = null;
                        v.source.stop();
                    } catch (e) { /* already stopped */ }
                    try { v.source.disconnect(); } catch (e) {}
                    v.source = null;
                }
                if (v.gain) {
                    try { v.gain.disconnect(); } catch (e) {}
                    v.gain = null;
                }
            });
            sourcesActive = false;
        }

        function startSourcesAt(offset) {
            const ctx = getSharedContext();
            if (!ctx) return;

            stopSources();

            const when = ctx.currentTime;

            versions.forEach((v, index) => {
                if (!v.buffer) return;
                const source = ctx.createBufferSource();
                source.buffer = v.buffer;
                const gain = ctx.createGain();
                gain.gain.value = index === currentVersionIndex ? 1 : 0;
                source.connect(gain).connect(ctx.destination);

                const safeOffset = Math.min(
                    Math.max(offset, 0),
                    Math.max(v.buffer.duration - 0.0001, 0)
                );
                try {
                    source.start(when, safeOffset);
                } catch (e) { /* ignore */ }

                v.source = source;
                v.gain = gain;
            });

            baseOffset = offset;
            startedAtCtxTime = when;
            sourcesActive = true;

            attachEndedHandlerToActive();
        }

        function attachEndedHandlerToActive() {
            const ctx = sharedContext;
            if (!ctx) return;
            versions.forEach((v, index) => {
                if (!v.source) return;
                if (index === currentVersionIndex && v.buffer) {
                    const source = v.source;
                    const activeBuffer = v.buffer;
                    source.onended = () => {
                        if (v.source !== source) return;
                        const elapsed = ctx.currentTime - startedAtCtxTime;
                        const reachedEnd = (baseOffset + elapsed) >= (activeBuffer.duration - 0.05);
                        if (reachedEnd && isPlaying) {
                            isPlaying = false;
                            hasCompletedPlayback = true;
                            baseOffset = activeBuffer.duration;
                            sourcesActive = false;
                            stopProgressAnimation();
                            updateProgress();
                            updatePlayerState();
                        }
                    };
                } else {
                    v.source.onended = null;
                }
            });
        }

        function playCurrentVersion() {
            const ctx = getSharedContext();
            if (!ctx) {
                return;
            }

            const requestId = playRequestId + 1;
            playRequestId = requestId;

            pauseOtherPlayers();
            hasStarted = true;
            hasCompletedPlayback = false;
            previousButton.disabled = false;
            nextButton.disabled = false;

            setLoading(true);
            updatePlayerState();

            const resumePromise = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();

            resumePromise
                .then(() => ensureAllDecoded())
                .then(() => {
                    if (requestId !== playRequestId) return;

                    let offset = baseOffset;
                    const duration = getActiveDuration();
                    if (Number.isFinite(duration) && duration > 0 && offset >= duration - 0.05) {
                        offset = 0;
                    }

                    startSourcesAt(offset);
                    isPlaying = true;
                    setLoading(false);
                    updatePlayerState();
                    startProgressAnimation();
                })
                .catch(() => {
                    if (requestId !== playRequestId) return;
                    isPlaying = false;
                    setLoading(false);
                    updatePlayerState();
                });
        }

        function switchVersion(direction) {
            if (!hasStarted) {
                return;
            }

            currentVersionIndex = (currentVersionIndex + direction + versions.length) % versions.length;
            hasCompletedPlayback = false;

            // Sample-accurate, zero-latency A/B/C switch: just flip the gains.
            // All sources are running in lockstep, so this is glitch-free.
            const ctx = sharedContext;
            if (sourcesActive && ctx) {
                versions.forEach((v, index) => {
                    if (v.gain) {
                        v.gain.gain.setValueAtTime(
                            index === currentVersionIndex ? 1 : 0,
                            ctx.currentTime
                        );
                    }
                });
                attachEndedHandlerToActive();
            }

            updateProgress();
            updatePlayerState();
        }

        function seekTo(time) {
            const wasPlaying = isPlaying || isLoading;
            if (sourcesActive) {
                stopSources();
            }
            baseOffset = Math.max(0, time);
            isPlaying = false;
            stopProgressAnimation();

            if (wasPlaying) {
                playCurrentVersion();
            } else {
                updateProgress();
                updatePlayerState();
            }
        }

        function pauseOtherPlayers() {
            instances.forEach((otherInstance) => {
                if (otherInstance !== instance) {
                    otherInstance.pauseFromOutside();
                }
            });
        }

        function pauseCurrentAudio() {
            playRequestId += 1;
            const ctx = sharedContext;
            if (sourcesActive && ctx) {
                const elapsed = ctx.currentTime - startedAtCtxTime;
                const duration = getActiveDuration();
                let newOffset = baseOffset + elapsed;
                if (Number.isFinite(duration) && duration > 0) {
                    newOffset = Math.min(newOffset, duration);
                }
                baseOffset = Math.max(0, newOffset);
            }
            stopSources();
            isPlaying = false;
            setLoading(false);
            stopProgressAnimation();
        }

        function setLoading(loading) {
            isLoading = loading;
            updatePlayerState();
        }

        function updatePlayerState() {
            const activeVersion = getActiveVersion();

            playButton.innerHTML = isLoading ? loadingIcon : isPlaying ? pauseIcon : playIcon;
            playButton.setAttribute('aria-label', isLoading || isPlaying ? 'Pause audio' : 'Play audio');
            player.setAttribute('aria-busy', isLoading ? 'true' : 'false');
            player.classList.toggle('is-playing', isPlaying);
            player.classList.toggle('is-loading', isLoading);

            if (versionText) {
                versionText.innerHTML = hasStarted ? activeVersion.label : '&nbsp;';
            }

            if (overlay) {
                overlay.textContent = hasStarted ? activeVersion.tooltip : '';
            }
        }

        function updateProgress() {
            const duration = getActiveDuration();
            const currentTime = getCurrentPlaybackTime();
            const percentage = Number.isFinite(duration) && duration > 0
                ? (currentTime / duration) * 100
                : 0;

            progressFill.style.width = `${Math.min(Math.max(percentage, 0), 100)}%`;
        }

        function startProgressAnimation() {
            stopProgressAnimation();

            const step = () => {
                updateProgress();
                if (isPlaying) {
                    animationFrameId = requestAnimationFrame(step);
                }
            };

            animationFrameId = requestAnimationFrame(step);
        }

        function stopProgressAnimation() {
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        }
    });
}
