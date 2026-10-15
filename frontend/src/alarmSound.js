let audioContext = null;
let alarmInterval = null;

export function enableAlarmAudio() {
    const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
        console.error("Web Audio API is not supported.");
        return false;
    }

    if (!audioContext) {
        audioContext = new AudioContextClass();
    }

    if (audioContext.state === "suspended") {
        return audioContext.resume().then(() => true);
    }

    return true;
}

function playBeep() {
    if (!audioContext || audioContext.state !== "running") {
        console.warn("Alarm audio is not enabled yet.");
        return;
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(
        880,
        audioContext.currentTime
    );

    gainNode.gain.setValueAtTime(
        0.0001,
        audioContext.currentTime
    );

    gainNode.gain.exponentialRampToValueAtTime(
        0.5,
        audioContext.currentTime + 0.03
    );

    gainNode.gain.setValueAtTime(
        0.5,
        audioContext.currentTime + 0.2
    );

    gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + 0.4
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.4);
}

export function startAlarmSound() {
    if (alarmInterval !== null) {
        return;
    }

    playBeep();

    alarmInterval = window.setInterval(() => {
        playBeep();
    }, 700);
}

export function stopAlarmSound() {
    if (alarmInterval !== null) {
        window.clearInterval(alarmInterval);
        alarmInterval = null;
    }
}

export function closeAlarmAudio() {
    stopAlarmSound();

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
}