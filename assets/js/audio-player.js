const players = document.querySelectorAll('.player__wrapper');

initializePlayers(players);

function initializePlayers(players) {
    const instances = [];
    const playIcon = '<i class="fa-solid fa-play"></i>';
    const pauseIcon = '<i class="fa-solid fa-pause"></i>';
    const loadingIcon = '<i class="fa-solid fa-spinner"></i>';

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
        ].map((version) => {
            const audio = document.createElement('audio');
            audio.src = version.src;
            audio.preload = 'none';
            audio.setAttribute('hidden', 'true');
            document.body.append(audio);

            return {
                ...version,
                audio,
            };
        });

        let currentVersionIndex = 0;
        let hasStarted = false;
        let isPlaying = false;
        let isLoading = false;
        let hasWarmedAlternateVersions = false;
        let hasCompletedPlayback = false;
        let animationFrameId = null;
        let playRequestId = 0;
        const requestedPreloads = new WeakMap();

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
                setAllAudioTimes(0);
                updateProgress();
                updatePlayerState();
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

            const activeAudio = getActiveVersion().audio;

            if (!Number.isFinite(activeAudio.duration) || activeAudio.duration <= 0) {
                return;
            }

            const rect = progress.getBoundingClientRect();
            const percentage = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
            const nextTime = percentage * activeAudio.duration;

            setAllAudioTimes(nextTime);
            hasCompletedPlayback = false;
            updateProgress();
        });

        versions.forEach(({ audio }) => {
            audio.addEventListener('timeupdate', updateProgress);
            audio.addEventListener('loadedmetadata', updateProgress);
            audio.addEventListener('waiting', () => {
                if (audio === getActiveVersion().audio && (isPlaying || isLoading)) {
                    setLoading(true);
                }
            });
            audio.addEventListener('playing', () => {
                if (audio === getActiveVersion().audio) {
                    isPlaying = true;
                    setLoading(false);
                    updatePlayerState();
                    startProgressAnimation();
                }
            });
            audio.addEventListener('canplay', () => {
                if (audio === getActiveVersion().audio) {
                    setLoading(false);
                }
            });
            audio.addEventListener('ended', () => {
                isPlaying = false;
                setLoading(false);
                hasCompletedPlayback = true;
                stopProgressAnimation();
                updateProgress();
                updatePlayerState();
            });
        });

        function getActiveVersion() {
            return versions[currentVersionIndex];
        }

        function playCurrentVersion() {
            const activeVersion = getActiveVersion();
            const activeAudio = activeVersion.audio;
            const requestedTime = activeAudio.currentTime || 0;
            const requestId = playRequestId + 1;
            playRequestId = requestId;

            pauseOtherPlayers();
            hasStarted = true;
            hasCompletedPlayback = false;
            previousButton.disabled = false;
            nextButton.disabled = false;

            if (isAudioAtEnd(activeAudio)) {
                setAllAudioTimes(0);
            }

            prepareAudio(activeAudio, 'auto');

            if (requestedTime > 0) {
                setAudioTime(activeAudio, requestedTime);
            }

            setLoading(true);

            const playPromise = activeAudio.play();

            Promise.resolve(playPromise)
                .then(() => {
                    if (requestId !== playRequestId) {
                        return;
                    }

                    isPlaying = true;
                    setLoading(false);
                    updatePlayerState();
                    startProgressAnimation();
                    warmUpAlternateVersions();
                })
                .catch(() => {
                    if (requestId !== playRequestId) {
                        return;
                    }

                    isPlaying = false;
                    setLoading(false);
                    updatePlayerState();
                });
        }

        function switchVersion(direction) {
            if (!hasStarted) {
                return;
            }

            const shouldResume = isPlaying || isLoading;
            const currentTime = getCurrentPlaybackTime();

            pauseCurrentAudio();
            hasCompletedPlayback = false;
            currentVersionIndex = (currentVersionIndex + direction + versions.length) % versions.length;
            setAllAudioTimes(currentTime);
            updateProgress();

            if (shouldResume) {
                playCurrentVersion();
                return;
            }

            updatePlayerState();
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
            versions.forEach(({ audio }) => audio.pause());
            isPlaying = false;
            setLoading(false);
            stopProgressAnimation();
        }

        function setLoading(loading) {
            isLoading = loading;
            updatePlayerState();
        }

        function prepareAudio(audio, preload = 'auto') {
            const previousPreload = requestedPreloads.get(audio);

            if (audio.preload !== preload) {
                audio.preload = preload;
            }

            if (previousPreload !== preload) {
                audio.load();
                requestedPreloads.set(audio, preload);
            }
        }

        function warmUpAlternateVersions() {
            if (hasWarmedAlternateVersions) {
                return;
            }

            hasWarmedAlternateVersions = true;

            window.setTimeout(() => {
                versions.forEach(({ audio }, index) => {
                    if (index !== currentVersionIndex) {
                        prepareAudio(audio, shouldAvoidBackgroundPreload() ? 'metadata' : 'auto');
                    }
                });
            }, 250);
        }

        function shouldAvoidBackgroundPreload() {
            return Boolean(navigator.connection && navigator.connection.saveData);
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
            const activeAudio = getActiveVersion().audio;
            const duration = activeAudio.duration;
            const currentTime = activeAudio.currentTime;
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

        function getCurrentPlaybackTime() {
            return Math.max(...versions.map(({ audio }) => audio.currentTime || 0));
        }

        function setAllAudioTimes(time) {
            versions.forEach(({ audio }) => {
                const nextTime = !Number.isFinite(audio.duration) || audio.duration <= 0
                    ? time
                    : Math.min(time, Math.max(audio.duration - 0.05, 0));

                if (!Number.isFinite(nextTime) || nextTime < 0) {
                    return;
                }

                if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
                    setAudioTime(audio, nextTime);
                    return;
                }

                setAudioTime(audio, nextTime);
            });
        }

        function setAudioTime(audio, time) {
            try {
                audio.currentTime = time;
            } catch (error) {
                // Some browsers reject early seeks before metadata is available.
            }
        }

        function isAudioAtEnd(audio) {
            return Number.isFinite(audio.duration)
                && audio.duration > 0
                && audio.currentTime >= audio.duration - 0.05;
        }
    });
}
