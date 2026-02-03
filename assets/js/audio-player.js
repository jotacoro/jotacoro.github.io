let players = document.querySelectorAll('.player__wrapper');

initializePlayers(players);

function initializePlayers(players) {
    players.forEach((player) => {
        //Set up audio elements
        var soundA = document.createElement('audio');
        //Set audio A src here
        soundA.src = player.getAttribute('data-audio-a');
        soundA.preload = 'auto';
        soundA.setAttribute('hidden', 'true');
        document.body.append(soundA);

        var soundB = document.createElement('audio');
        //Set audio B src here
        soundB.src = player.getAttribute('data-audio-b');
        soundB.preload = 'auto';
        soundB.setAttribute('hidden', 'true');
        document.body.append(soundB);

        var soundC = document.createElement('audio');
        //Set audio C src here
        soundC.src = player.getAttribute('data-audio-c');
        soundC.preload = 'auto';
        soundC.setAttribute('hidden', 'true');
        document.body.append(soundC);

        //Get button elements
        const aButton = player.querySelector('.a__button');
        const bButton = player.querySelector('.b__button');
        const cButton = player.querySelector('.c__button');
        const playButton = player.querySelector('.play__button');
        const stopButton = player.querySelector('.stop__button');
        const progressBar = player.querySelector('.progress__bar');
        const progressFill = player.querySelector('.progress__fill');

        const playIcon = '<i class="fa-solid fa-play"></i>';
        const pauseIcon = '<i class="fa-solid fa-pause"></i>';
        const stopIcon = '<i class="fa-solid fa-stop"></i>';

        //Check for mobile to enable audio playback without waiting for download status.
        if (
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                navigator.userAgent
            )
        ) {
            aButton.disabled = false;
            playButton.disabled = false;
        }

        //Default loading state for each sound
        var soundAReady = false;
        var soundBReady = false;
        var soundCReady = false;

        //When audio can play through (loaded), run the function to enable buttons
        //The canplaythrough event will fire every time the audio switches, so the !soundA/BReady prevents additional checks
        soundA.oncanplaythrough = function () {
            if (!soundAReady) {
                soundAReady = true;
                audioIsReady();
            }
        };
        soundB.oncanplaythrough = function () {
            if (!soundBReady) {
                soundBReady = true;
                audioIsReady();
            }
        };

        soundC.oncanplaythrough = function () {
            if (!soundCReady) {
                soundCReady = true;
                audioIsReady();
            }
        };

        // Check if both A & B are ready and enable the correct buttons
        function audioIsReady() {
            if (soundAReady && soundBReady && soundCReady) {
                console.log('...audio loaded!');
                aButton.disabled = false;
                playButton.disabled = false;
            } else {
                console.log('Audio loading...');
            }
        }

        const progress = player.querySelector('.progress');
        // Listen for click on entire progress bar div (to allow skipping ahead)
        progress.addEventListener('click', function (event) {
            // Get X coordinate of click in div
            var rect = this.getBoundingClientRect();
            // Convert click position to percentage value
            var percentage = (event.clientX - rect.left) / this.offsetWidth;
            // Seek to the percentage converted to seconds
            soundA.currentTime = percentage * soundA.duration;
            soundB.currentTime = percentage * soundB.duration;
            soundC.currentTime = percentage * soundC.duration;
        });

        //Play/Stop correct audio and toggle A/B, Play/Pause, and Stop buttons
        function playPause() {
            if (soundA.paused && soundB.paused && soundC.paused) {
                let soundATime = soundA.currentTime;
                let soundBTime = soundB.currentTime;
                let soundCTime = soundC.currentTime;
                let maxTime = Math.max(soundATime, soundBTime, soundCTime);
                if (maxTime === soundATime) {
                    soundA.play();
                    aButton.disabled = true;
                    bButton.disabled = false;
                    cButton.disabled = false;
                    playButton.innerHTML = pauseIcon;

                    //Change A button style
                    player.querySelectorAll('.a__button').forEach((btn) => {
                        btn.style.background = '#c7daff';
                        btn.style.color = '#2118a3';
                        btn.style.fontWeight = 'bold';
                        btn.style.border = '2px solid #2118a3';
                    });
                } else if (maxTime === soundBTime) {
                    soundB.play();
                    aButton.disabled = false;
                    bButton.disabled = true;
                    cButton.disabled = false;
                    playButton.innerHTML = pauseIcon;

                    //Change B button style
                    player.querySelectorAll('.b__button').forEach((btn) => {
                        btn.style.background = '#c7daff';
                        btn.style.color = '#2118a3';
                        btn.style.fontWeight = 'bold';
                        btn.style.border = '2px solid #2118a3';
                    });
                } else {
                    soundC.play();
                    aButton.disabled = false;
                    bButton.disabled = false;
                    cButton.disabled = true;
                    playButton.innerHTML = pauseIcon;

                    //Change C button style
                    player.querySelectorAll('.c__button').forEach((btn) => {
                        btn.style.background = '#c7daff';
                        btn.style.color = '#2118a3';
                        btn.style.fontWeight = 'bold';
                        btn.style.border = '2px solid #2118a3';
                    });
                }
                stopButton.disabled = false;
            } else {
                playButton.innerHTML = playIcon;
                soundA.pause();
                soundB.pause();
                soundC.pause();
            }
        }

        aButton.addEventListener('click', (e) => {
            pauseAll();
            playButton.innerHTML = pauseIcon;
            aButton.disabled = true;
            bButton.disabled = false;
            cButton.disabled = false;

            //Button is now disabled. Change style
            player.querySelectorAll('.ab__button:disabled').forEach((btn) => {
                btn.style.background = '#c7daff';
                btn.style.color = '#2118a3';
                btn.style.fontWeight = 'bold';
                btn.style.border = '2px solid #2118a3';
            });

            //Change font color of the rest of buttons
            player.querySelectorAll('.b__button, .c__button').forEach((btn) => {
                btn.style.color = '#f5f5f5';
            });

            stopButton.disabled = false;
            let currentTime = Math.max(soundA.currentTime, soundB.currentTime, soundC.currentTime);
            if (currentTime > 0) {
                soundA.currentTime = currentTime;
                soundA.play();
                soundB.pause();
                soundC.pause();
            } else {
                soundA.play();
            }
        });

        bButton.addEventListener('click', (e) => {
            pauseAll();
            playButton.innerHTML = pauseIcon;
            bButton.disabled = true;
            aButton.disabled = false;
            cButton.disabled = false;

            //Button is now disabled. Change style
            player.querySelectorAll('.ab__button:disabled').forEach((btn) => {
                btn.style.background = '#c7daff';
                btn.style.color = '#2118a3';
                btn.style.fontWeight = 'bold';
                btn.style.border = '2px solid #2118a3';
            });

            //Change font color of the rest of buttons
            player.querySelectorAll('.a__button, .c__button').forEach((btn) => {
               btn.style.color = '#f5f5f5';
            });

            stopButton.disabled = false;
            let currentTime = Math.max(soundA.currentTime, soundB.currentTime, soundC.currentTime);
            if (currentTime > 0) {
                soundB.currentTime = currentTime;
                soundB.play();
                soundA.pause();
                soundC.pause();
            } else {
                soundB.play();
            }
        });

        cButton.addEventListener('click', (e) => {
            pauseAll();
            playButton.innerHTML = pauseIcon;
            cButton.disabled = true;
            aButton.disabled = false;
            bButton.disabled = false;

            //Button is now disabled. Change style
            player.querySelectorAll('.ab__button:disabled').forEach((btn) => {
                btn.style.background = '#c7daff';
                btn.style.color = '#2118a3';
                btn.style.fontWeight = 'bold';
                btn.style.border = '2px solid #2118a3';
            });

            //Change font color of the rest of buttons
            player.querySelectorAll('.a__button, .b__button').forEach((btn) => {
                btn.style.color = '#f5f5f5';
            });

            stopButton.disabled = false;
            let currentTime = Math.max(soundA.currentTime, soundB.currentTime, soundC.currentTime);
            if (currentTime > 0) {
                soundC.currentTime = currentTime;
                soundC.play();
                soundA.pause();
                soundB.pause();
            }
            soundC.play();
        });

        playButton.addEventListener('click', (e) => {
            let allAudio = document.querySelectorAll('audio');
            let allButtons = document.querySelectorAll('.play__button');
            for (let i = 0; i < allAudio.length; i++) {
                if (allAudio[i] !== soundA && allAudio[i] !== soundB && allAudio[i] !== soundC) {
                    allAudio[i].pause();
                }
            }
            for (let i = 0; i < allButtons.length; i++) {
                if (allButtons[i] !== playButton) {
                    allButtons[i].innerHTML = playIcon;
                }
            }
            playPause();
        });

        stopButton.addEventListener('click', (e) => {
            stopSounds();
        });

        soundA.addEventListener('playing', (e) => {
            console.log('playing a');
            progressFill.style.width =
                ((soundA.currentTime / soundA.duration) * 100 || 0) + '%';
            requestAnimationFrame(stepA);
        });

        soundB.addEventListener('playing', (e) => {
            console.log('playing b');
            progressFill.style.width =
                ((soundB.currentTime / soundB.duration) * 100 || 0) + '%';
            requestAnimationFrame(stepB);
        });

        soundC.addEventListener('playing', (e) => {
            console.log('playing c');
            progressFill.style.width =
                ((soundC.currentTime / soundC.duration) * 100 || 0) + '%';
            requestAnimationFrame(stepC);
        });

        const stopSounds = () => {
            playButton.innerHTML = playIcon;
            aButton.disabled = false;
            bButton.disabled = true;
            cButton.disabled = true;
            playButton.disabled = false;
            stopButton.disabled = true;
            soundA.pause();
            soundA.currentTime = 0;
            soundB.pause();
            soundB.currentTime = 0;
            soundC.pause();
            soundC.currentTime = 0;

            // Reset all button styles to original CSS values
            player.querySelectorAll('.a__button, .b__button, .c__button').forEach((btn) => {
                btn.style.background = '';
                btn.style.color = '';
                btn.style.fontWeight = '';
                btn.style.border = '';
            });
        };

        function pauseAll() {
            let allAudio = document.querySelectorAll('audio');
            allAudio.forEach((audio) => {
                audio.pause();
            });
            document.querySelectorAll('.play__button').forEach((button) => {
                button.innerHTML = playIcon;
            });
        }

        //Frame animations for progress bar fill - converts to CSS percentage
        function stepA() {
            progressFill.style.width =
                ((soundA.currentTime / soundA.duration) * 100 || 0) + '%';
            requestAnimationFrame(stepA);
        }
        function stepB() {
            progressFill.style.width =
                ((soundB.currentTime / soundB.duration) * 100 || 0) + '%';
            requestAnimationFrame(stepB);
        }
        function stepC() {
            progressFill.style.width =
                ((soundC.currentTime / soundC.duration) * 100 || 0) + '%';
            requestAnimationFrame(stepC);
        }
    });
}
