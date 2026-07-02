const audioKeys = [
    'sfx_click', 'sfx_attack1', 'sfx_attack2', 'sfx_hurt', 'sfx_death', 'sfx_dash', 'sfx_spell', 'sfx_highjump',
    'sfx_bubble_jump', 'sfx_bubble_break', 'sfx_ice_break',
    'sfx_jump', 'sfx_walk', 'sfx_land', 'sfx_teleport', 'sfx_shield_block', 
    'sfx_shield_break', 'sfx_block_place', 'sfx_ui_hover', 'sfx_ui_select'
];

// Create styles
const style = document.createElement('style');
style.textContent = `
    #sfx-admin-toggle {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        background: #44ff44;
        color: #000;
        border: 2px solid #fff;
        padding: 10px 15px;
        font-family: 'Press Start 2P', monospace;
        font-size: 12px;
        cursor: pointer;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.5);
    }
    #sfx-admin-toggle:hover {
        background: #fff;
    }
    #sfx-admin-panel {
        position: fixed;
        bottom: 70px;
        right: 20px;
        z-index: 10000;
        background: rgba(10, 10, 10, 0.95);
        color: #fff;
        border: 2px solid #44ff44;
        padding: 20px;
        font-family: 'Silkscreen', monospace;
        font-size: 14px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.8);
        display: none;
        max-height: 80vh;
        overflow-y: auto;
        min-width: 380px;
    }
    #sfx-admin-panel h2 {
        font-family: 'Press Start 2P', monospace;
        font-size: 12px;
        margin-top: 0;
        color: #44ff44;
        text-align: center;
        border-bottom: 2px solid #333;
        padding-bottom: 10px;
        line-height: 1.5;
    }
    .sfx-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        border-bottom: 1px solid #333;
        padding-bottom: 10px;
    }
    .sfx-key {
        font-weight: bold;
        flex: 1;
        font-size: 12px;
        color: #ddd;
    }
    .sfx-actions {
        display: flex;
        gap: 8px;
        align-items: center;
    }
    .sfx-btn {
        background: #222;
        color: #fff;
        border: 1px solid #555;
        padding: 5px 8px;
        cursor: pointer;
        font-family: 'Silkscreen', monospace;
        border-radius: 3px;
        transition: all 0.2s;
        font-size: 12px;
    }
    .sfx-btn:hover {
        background: #44ff44;
        color: #000;
        border-color: #44ff44;
    }
    .file-input {
        display: none;
    }
    /* Custom Scrollbar */
    #sfx-admin-panel::-webkit-scrollbar {
        width: 8px;
    }
    #sfx-admin-panel::-webkit-scrollbar-track {
        background: #111;
    }
    #sfx-admin-panel::-webkit-scrollbar-thumb {
        background: #444;
        border-radius: 4px;
    }
`;
document.head.appendChild(style);

// Create toggle button
const toggleBtn = document.createElement('button');
toggleBtn.id = 'sfx-admin-toggle';
toggleBtn.textContent = '🎵 SFX Admin';
document.body.appendChild(toggleBtn);

// Create panel
const panel = document.createElement('div');
panel.id = 'sfx-admin-panel';
document.body.appendChild(panel);

const title = document.createElement('h2');
title.innerHTML = 'Audio Replacement Panel<br><span style="font-size: 8px; color: #888; font-family: \'Silkscreen\'">Select .mp3 or .ogg files</span>';
panel.appendChild(title);

toggleBtn.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'none' || panel.style.display === '' ? 'block' : 'none';
});

audioKeys.forEach(key => {
    const row = document.createElement('div');
    row.className = 'sfx-row';

    const label = document.createElement('div');
    label.className = 'sfx-key';
    label.textContent = key;
    row.appendChild(label);

    const actions = document.createElement('div');
    actions.className = 'sfx-actions';

    // File Input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.className = 'file-input';
    fileInput.id = `file-${key}`;

    // Upload Button
    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'sfx-btn';
    uploadBtn.textContent = 'Upload';
    uploadBtn.onclick = () => fileInput.click();

    // Play Button
    const playBtn = document.createElement('button');
    playBtn.className = 'sfx-btn';
    playBtn.textContent = '▶ Play';
    playBtn.onclick = () => {
        if (window.game && window.game.sound) {
            window.game.sound.play(key);
        } else {
            console.error('Game sound manager not available.');
            alert('Wait for the game to finish loading!');
        }
    };

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const arrayBuffer = event.target.result;
            if (window.game && window.game.sound) {
                // Remove existing from cache
                if (window.game.cache.audio.has(key)) {
                    window.game.cache.audio.remove(key);
                }
                
                uploadBtn.textContent = '⏳ ...';
                
                // Set up a one-time listener for this decoding
                const decodeHandler = (decodedKey) => {
                    if (decodedKey === key) {
                        uploadBtn.textContent = '✅ Updated';
                        uploadBtn.style.background = '#44ff44';
                        uploadBtn.style.color = '#000';
                        setTimeout(() => {
                            uploadBtn.textContent = 'Upload';
                            uploadBtn.style.background = '#222';
                            uploadBtn.style.color = '#fff';
                        }, 2500);
                        window.game.sound.off('decoded', decodeHandler);
                    }
                };
                
                window.game.sound.on('decoded', decodeHandler);
                window.game.sound.decodeAudio(key, arrayBuffer);
            }
        };
        reader.readAsArrayBuffer(file);
    });

    actions.appendChild(fileInput);
    actions.appendChild(uploadBtn);
    actions.appendChild(playBtn);
    row.appendChild(actions);

    panel.appendChild(row);
});
