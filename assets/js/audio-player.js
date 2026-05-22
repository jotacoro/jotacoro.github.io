const players = document.querySelectorAll('.player__wrapper');

initializePlayers(players);

function initializePlayers(players) {
    const instances = [];
    const playIcon = '<i class="fa-solid fa-play"></i>';
    const pauseIcon = '<i class="fa-solid fa-pause"></i>';

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
            audio.preload = 'metadata';
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
        let hasCompletedPlayback = false;
        let animationFrameId = null;

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
            if (isPlaying) {
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
            audio.addEventListener('ended', () => {
                isPlaying = false;
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

            pauseOtherPlayers();
            hasStarted = true;
            hasCompletedPlayback = false;
            previousButton.disabled = false;
            nextButton.disabled = false;

            if (isAudioAtEnd(activeAudio)) {
                setAllAudioTimes(0);
            }

            activeAudio.play()
                .then(() => {
                    isPlaying = true;
                    updatePlayerState();
                    startProgressAnimation();
                })
                .catch(() => {
                    isPlaying = false;
                    updatePlayerState();
                });
        }

        function switchVersion(direction) {
            if (!hasStarted) {
                return;
            }

            const wasPlaying = isPlaying;
            const currentTime = getCurrentPlaybackTime();

            pauseCurrentAudio();
            hasCompletedPlayback = false;
            currentVersionIndex = (currentVersionIndex + direction + versions.length) % versions.length;
            setAllAudioTimes(currentTime);
            updateProgress();

            if (wasPlaying) {
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
            versions.forEach(({ audio }) => audio.pause());
            isPlaying = false;
            stopProgressAnimation();
        }

        function updatePlayerState() {
            const activeVersion = getActiveVersion();

            playButton.innerHTML = isPlaying ? pauseIcon : playIcon;
            playButton.setAttribute('aria-label', isPlaying ? 'Pause audio' : 'Play audio');
            player.classList.toggle('is-playing', isPlaying);

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
                if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
                    audio.currentTime = time;
                    return;
                }

                audio.currentTime = Math.min(time, Math.max(audio.duration - 0.05, 0));
            });
        }

        function isAudioAtEnd(audio) {
            return Number.isFinite(audio.duration)
                && audio.duration > 0
                && audio.currentTime >= audio.duration - 0.05;
        }
    });
}
