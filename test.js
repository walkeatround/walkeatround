// ==UserScript==
// @name         三风格极致UI终端 (Std API) - Enhanced & Multiline & Dynamic Character Stats
// @version      30.1
// @description  Full UI + Dynamic Stats Bars (First Position) + Color Coded + Mobile Friendly Refresh
// @author       Custom & Gemini & Assistant
// @match        */*
// ==/UserScript==

(function () {
    'use strict';

    const SCRIPT_ID = 'tri_hud_std_v30_dynamic';
    const SETTINGS_KEY = 'tri_hud_settings_v30';
    
    let settings = {
        autoSend: false,
        theme: 'luxury', 
        scale: 1.0,
        fontFamily: '',
        debug: true
    };

    let characterStats = {};

    // --- Utilities ---
    function loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
            if (saved) settings = { ...settings, ...saved };
            log('✓ Settings loaded successfully', 'success');
        } catch(e) { 
            console.error('[HUD] Failed to load settings:', e); 
        }
    }

    function saveSettings() {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        $('.hud-root').each(function() { applySettingsToElement($(this)); });
        log('✓ Settings saved', 'success');
    }

    function log(msg, type = 'info') {
        if (!settings.debug) return;
        const prefix = '[HUD-v30]';
        const styles = {
            'info': 'color: #2196F3',
            'success': 'color: #4CAF50; font-weight: bold',
            'warning': 'color: #FF9800',
            'error': 'color: #F44336; font-weight: bold',
            'data': 'color: #9C27B0'
        };
        console.log(`%c${prefix} ${msg}`, styles[type] || styles.info);
    }

    // --- 动态提取JSON变量数据 ---
    function extractDynamicStats(text) {
        log('→ Extracting dynamic stats from content...', 'info');
        try {
            const jsonMatch = text.match(/^\s*(\{[\s\S]*?\})\s*(?=状态栏|$)/);
            if (!jsonMatch) {
                log('✗ No JSON data found in content', 'warning');
                return null;
            }

            const jsonStr = jsonMatch[1];
            log(`→ Found JSON string: ${jsonStr.substring(0, 100)}...`, 'data');
            
            const parsed = JSON.parse(jsonStr);
            log('✓ JSON parsed successfully', 'success');
            
            const result = {};
            for (let charName in parsed) {
                result[charName] = {};
                const charData = parsed[charName];
                
                for (let attrKey in charData) {
                    const attrValue = charData[attrKey];
                    if (Array.isArray(attrValue) && attrValue.length >= 2) {
                        result[charName][attrKey] = {
                            value: parseFloat(attrValue[0]) || 0,
                            label: attrValue[1] || attrKey,
                            max: extractMaxFromLabel(attrValue[1])
                        };
                    } else {
                        result[charName][attrKey] = {
                            value: parseFloat(attrValue) || 0,
                            label: attrKey,
                            max: 100
                        };
                    }
                }
                log(`✓ Extracted ${Object.keys(result[charName]).length} attributes for "${charName}"`, 'success');
            }
            
            characterStats = result;
            log(`✓ Total characters loaded: ${Object.keys(result).length}`, 'success');
            console.log('[HUD] Character Stats Data:', result);
            return result;
            
        } catch(e) {
            console.error('[HUD] Failed to extract dynamic stats:', e);
            log(`✗ JSON parsing error: ${e.message}`, 'error');
            return null;
        }
    }

    function extractMaxFromLabel(label) {
        const match = label.match(/\((\d+)-(\d+)\)/);
        if (match) {
            return parseInt(match[2]) || 100;
        }
        return 100;
    }

    // --- CSS ---
    const STYLES = `
    :root { --hud-font-main: 'Segoe UI', 'Microsoft YaHei', sans-serif; --hud-scale: 1; }
    .hud-root {
        font-size: calc(13px * var(--hud-scale)); font-family: var(--hud-font-main);
        margin: 10px 0 20px 0; border-radius: 12px; overflow: hidden; position: relative;
        line-height: 1.5; box-shadow: 0 6px 18px rgba(0,0,0,0.15);
        pointer-events: auto; z-index: 5; user-select: text;
        transition: all 0.3s ease;
    }

    /* 刷新按钮样式 - 移动端优化 */
    .hud-refresh-btn {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        opacity: 0.6;
        transition: all 0.3s ease;
        z-index: 10;
        font-size: 14px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    }
    .hud-refresh-btn:hover {
        opacity: 1;
        transform: rotate(180deg) scale(1.1);
    }
    .hud-refresh-btn:active {
        transform: rotate(180deg) scale(0.95);
    }

    /* 移动端触摸优化 */
    @media (max-width: 768px) {
        .hud-refresh-btn {
            width: 36px;
            height: 36px;
            opacity: 0.7;
            font-size: 16px;
        }
    }

    /* --- Theme 1: Luxury (Business/Gold) --- */
    .hud-theme-luxury {
        --bg: #1a2226; --c-val: #eceff1; --border: #c4a47c; 
        --c-name: #ffecb3; --c-key: #90a4ae; --c-title: #ffe082; 
        --c-text: #cfd8dc; --c-idx: #c4a47c;
        background: linear-gradient(135deg, #1b2327 0%, #263238 100%);
        color: var(--c-val);
        border-left: 4px solid var(--border);
        border-right: 1px solid rgba(196, 164, 124, 0.3);
    }
    .hud-theme-luxury::before {
        content: ''; position: absolute; top:0; left:0; right:0; bottom:0; opacity: 0.05;
        background: repeating-linear-gradient(45deg, #000 0px, #000 2px, transparent 2px, transparent 6px);
        pointer-events: none;
    }
    .hud-theme-luxury .hud-head { border-bottom: 1px solid rgba(196, 164, 124, 0.2); background: rgba(0,0,0,0.2); }
    .hud-theme-luxury .hud-user-card {
        background: linear-gradient(to bottom, #222b30, #1d2428);
        border: 1px solid rgba(196, 164, 124, 0.3);
        box-shadow: inset 0 0 15px rgba(0,0,0,0.3);
    }
    .hud-theme-luxury .hud-tag-key {
        color: #d4af37 !important; text-transform: uppercase; letter-spacing: 0.5px;
        border-bottom: 1px solid rgba(212, 175, 55, 0.2); padding-bottom: 2px; margin-bottom: 3px;
    }
    .hud-theme-luxury .hud-kv { border-bottom: 1px dashed rgba(255,255,255,0.05); }
    .hud-theme-luxury .hud-btn { border-bottom: 1px solid rgba(255,255,255,0.03); }
    .hud-theme-luxury .hud-btn:hover { background: linear-gradient(90deg, rgba(196, 164, 124, 0.15), transparent); }
    .hud-theme-luxury .hud-idx { color: #d4af37; border: 1px solid #d4af37; border-radius: 4px; height: 20px; width: 20px; line-height: 18px; font-size: 0.8em; }
    .hud-theme-luxury .hud-stat-bar-container { background: rgba(0,0,0,0.4); border: 1px solid rgba(196, 164, 124, 0.2); }
    
    /* Luxury主题 - 渐变金色系配色 */
    .hud-theme-luxury .hud-stat-bar-fill.color-0 { background: linear-gradient(90deg, #d4af37, #c4a47c); }
    .hud-theme-luxury .hud-stat-bar-fill.color-1 { background: linear-gradient(90deg, #b8860b, #daa520); }
    .hud-theme-luxury .hud-stat-bar-fill.color-2 { background: linear-gradient(90deg, #cd7f32, #e6be8a); }
    .hud-theme-luxury .hud-stat-bar-fill.color-3 { background: linear-gradient(90deg, #918151, #c9b037); }
    .hud-theme-luxury .hud-stat-bar-fill.color-4 { background: linear-gradient(90deg, #967117, #d4af37); }
    .hud-theme-luxury .hud-stat-bar-fill.color-5 { background: linear-gradient(90deg, #aa771c, #ffd700); }
    
    .hud-theme-luxury .hud-refresh-btn { background: rgba(196, 164, 124, 0.4); color: #d4af37; border: 1px solid rgba(212, 175, 55, 0.3); }
    .hud-theme-luxury .hud-refresh-btn:hover { background: rgba(196, 164, 124, 0.7); box-shadow: 0 0 12px rgba(212, 175, 55, 0.6); }

    /* --- Theme 2: Floral (Fresh/Nature) --- */
    .hud-theme-floral {
        --bg: #fff; --c-val: #37474f; --c-name: #2e7d32; --c-key: #558b2f; 
        --c-title: #e57373; --c-text: #546e7a; --c-idx: #fff;
        background: #fafafa;
        color: var(--c-val); border-radius: 16px;
        border: 1px solid #e0e0e0;
        background-image: 
            radial-gradient(circle at 0% 0%, #e8f5e9 0%, transparent 50%), 
            radial-gradient(circle at 100% 100%, #e1f5fe 0%, transparent 50%);
    }
    .hud-theme-floral .hud-head { background: rgba(255,255,255,0.6); backdrop-filter: blur(4px); border-bottom: 1px dashed #b0bec5; }
    .hud-theme-floral .hud-user-card {
        background: rgba(255,255,255,0.9);
        border: 1px solid #e8f5e9;
        box-shadow: 2px 4px 12px rgba(0,0,0,0.03);
        border-radius: 12px;
    }
    .hud-theme-floral .hud-tag-key {
        background: #f1f8e9; padding: 2px 8px; border-radius: 12px; width: fit-content;
        color: #33691e !important; box-shadow: 1px 1px 2px rgba(0,0,0,0.05);
    }
    .hud-theme-floral .hud-kv { border-bottom: 1px dotted #cfd8dc; }
    .hud-theme-floral .hud-btn { border-radius: 8px; margin: 2px 0; }
    .hud-theme-floral .hud-btn:hover { background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transform: translateX(2px); }
    .hud-theme-floral .hud-idx { background: #78909c; border-radius: 50%; width: 24px; height: 24px; box-shadow: 1px 2px 4px rgba(0,0,0,0.2); }
    .hud-theme-floral .hud-stat-bar-container { background: #e0e0e0; border: 1px solid #c8e6c9; }
    
    /* Floral主题 - 清新自然配色 */
    .hud-theme-floral .hud-stat-bar-fill.color-0 { background: linear-gradient(90deg, #66bb6a, #43a047); }
    .hud-theme-floral .hud-stat-bar-fill.color-1 { background: linear-gradient(90deg, #42a5f5, #1e88e5); }
    .hud-theme-floral .hud-stat-bar-fill.color-2 { background: linear-gradient(90deg, #26a69a, #00897b); }
    .hud-theme-floral .hud-stat-bar-fill.color-3 { background: linear-gradient(90deg, #ab47bc, #8e24aa); }
    .hud-theme-floral .hud-stat-bar-fill.color-4 { background: linear-gradient(90deg, #ef5350, #e53935); }
    .hud-theme-floral .hud-stat-bar-fill.color-5 { background: linear-gradient(90deg, #ff7043, #f4511e); }
    
    .hud-theme-floral .hud-refresh-btn { background: rgba(120, 144, 156, 0.4); color: #558b2f; border: 1px solid rgba(85, 139, 47, 0.3); }
    .hud-theme-floral .hud-refresh-btn:hover { background: rgba(120, 144, 156, 0.7); box-shadow: 0 0 10px rgba(85, 139, 47, 0.5); }

    /* --- Theme 3: Candy (Pop/Vibrant) --- */
    .hud-theme-candy {
        --bg: #fff0f5;
        --c-val: #4a0072;
        --c-name: #d500f9;
        --c-key: #c51162;
        --c-title: #f57c00;
        --c-text: #3e2723;
        --c-idx: #fff;
        background: var(--bg);
        color: var(--c-val);
        border: 3px solid #ff80ab;
        border-radius: 20px;
        background-image: radial-gradient(#ffc1e3 15%, transparent 16%), radial-gradient(#ffc1e3 15%, transparent 16%);
        background-position: 0 0, 10px 10px;
        background-size: 20px 20px;
        box-shadow: 4px 4px 0px #ff80ab;
    }
    .hud-theme-candy .hud-head { background: rgba(255,255,255,0.8); border-bottom: 2px solid #ff80ab; }
    .hud-theme-candy .hud-user-card {
        background: #fff;
        border-radius: 16px;
        border: 2px solid #b39ddb;
        box-shadow: 3px 3px 0 #b39ddb;
        color: #333;
    }
    .hud-theme-candy .hud-user-name {
        text-shadow: 1px 1px 0 #ffeb3b; letter-spacing: 1px;
        background: #f3e5f5; padding: 4px; border-radius: 8px; text-align: center;
    }
    .hud-theme-candy .hud-tag-key {
        color: #fff !important; background: #ff4081; 
        padding: 3px 10px; border-radius: 20px; font-weight: 800; 
        box-shadow: 1px 2px 0 rgba(0,0,0,0.1);
        display: inline-flex;
    }
    .hud-theme-candy .hud-tag-val { color: #4a148c; font-weight: 600; padding-left: 4px; }
    .hud-theme-candy .hud-kv { border-bottom: 2px dotted #ffc1e3; margin-bottom: 10px; }
    .hud-theme-candy .hud-btn {
        margin-bottom: 4px; background: rgba(255,255,255,0.6); 
        border: 2px solid transparent; border-radius: 12px;
    }
    .hud-theme-candy .hud-btn:hover { 
        background: #fff; border-color: #00bcd4; box-shadow: 2px 2px 0 #00bcd4; 
    }
    .hud-theme-candy .hud-idx { 
        background: #00bcd4; border-radius: 50%; 
        width: 26px; height: 26px; border: 2px solid #fff; box-shadow: 1px 1px 3px rgba(0,0,0,0.2);
    }
    .hud-theme-candy .hud-stat-bar-container { background: #ffc1e3; border: 1px solid #ff80ab; }
    
    /* Candy主题 - 活力糖果配色 */
    .hud-theme-candy .hud-stat-bar-fill.color-0 { background: linear-gradient(90deg, #ff4081, #f50057); }
    .hud-theme-candy .hud-stat-bar-fill.color-1 { background: linear-gradient(90deg, #e040fb, #d500f9); }
    .hud-theme-candy .hud-stat-bar-fill.color-2 { background: linear-gradient(90deg, #00bcd4, #00acc1); }
    .hud-theme-candy .hud-stat-bar-fill.color-3 { background: linear-gradient(90deg, #ffd600, #ffc400); }
    .hud-theme-candy .hud-stat-bar-fill.color-4 { background: linear-gradient(90deg, #ff6e40, #ff5722); }
    .hud-theme-candy .hud-stat-bar-fill.color-5 { background: linear-gradient(90deg, #69f0ae, #00e676); }
    
    .hud-theme-candy .hud-refresh-btn { background: rgba(255, 64, 129, 0.4); color: #c51162; border: 2px solid rgba(197, 17, 98, 0.3); }
    .hud-theme-candy .hud-refresh-btn:hover { background: rgba(255, 64, 129, 0.7); box-shadow: 0 0 12px rgba(197, 17, 98, 0.6); }

    /* --- Dynamic Character Stat Bar Styles --- */
    .hud-stat-bar-wrapper {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 6px 10px;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid rgba(128,128,128,0.2);
    }
    .hud-stat-bar-wrapper.single-col {
        grid-template-columns: 1fr;
    }
    .hud-stat-bar {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 0.9em;
    }
    .hud-stat-bar-label {
        font-weight: 600;
        opacity: 0.9;
        font-size: 0.85em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .hud-stat-bar-container {
        height: 18px;
        border-radius: 9px;
        overflow: hidden;
        position: relative;
    }
    .hud-stat-bar-fill {
        height: 100%;
        border-radius: 9px;
        transition: width 0.4s ease;
        position: relative;
    }
    .hud-stat-bar-text {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75em;
        font-weight: 700;
        color: rgba(0,0,0,0.7);
        text-shadow: 0 0 3px rgba(255,255,255,0.9);
    }

    /* --- General Layout --- */
    .hud-head { padding: 10px 16px; display: flex; flex-wrap: wrap; gap: 15px; font-size: 0.9em; align-items: center; }
    .hud-stat-item { display: flex; align-items: center; gap: 8px; font-weight: 500; }
    
    .hud-users-toggle { 
        padding: 8px 16px; font-size: 0.9em; display: flex; justify-content: space-between; 
        background: rgba(0,0,0,0.03); font-weight: bold; cursor: pointer; user-select: none; 
        border-top: 1px solid rgba(0,0,0,0.05); border-bottom: 1px solid rgba(0,0,0,0.05);
    }
    .hud-users-scroll { display: flex; overflow-x: auto; gap: 14px; padding: 14px 16px; scrollbar-width: thin; }
    .hud-user-card { flex: 0 0 280px; padding: 14px; display: flex; flex-direction: column; gap: 8px; transition: transform 0.2s; }
    .hud-user-card:hover { transform: translateY(-2px); }
    
    .hud-user-name { font-weight: 800; font-size: 1.25em; margin-bottom: 6px; border-bottom: 2px solid rgba(0,0,0,0.05); padding-bottom: 6px; }
    .hud-kv { display: flex; flex-direction: column; gap: 4px; padding-bottom: 8px; margin-bottom: 8px; }
    .hud-kv:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .hud-tag-key { font-size: 1.05em; opacity: 0.95; font-weight: bold; display: flex; align-items: center; gap: 6px; }
    .hud-tag-val { font-size: 1em; line-height: 1.4; padding-left: 2px; opacity: 0.95; white-space: pre-wrap; }

    .hud-opts-container { width: 100%; overflow-x: auto; padding: 10px 16px; scrollbar-width: thin; }
    .hud-opts-list { 
        display: flex; flex-direction: column; gap: 4px; 
        min-width: 400px;
        width: fit-content; min-width: 100%; 
    }
    .hud-btn { display: flex; align-items: center; padding: 6px 10px; transition: all 0.2s; width: 100%; cursor: pointer; }
    .hud-idx { flex: 0 0 26px; text-align: center; font-weight: bold; font-size: 0.95em; margin-right: 10px; display: flex; align-items: center; justify-content: center; }
    
    .hud-btn-content { 
        flex: 1; font-size: 0.95em; line-height: 1.4; 
        display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; 
    }
    .hud-btn-title { font-weight: 800; font-size: 1em; margin-right: 0; white-space: nowrap; }
    .hud-btn-text { opacity: 0.9; flex: 1; min-width: 200px; }
    
    .hud-tips { padding: 10px 16px; font-size: 0.9em; opacity: 0.8; border-top: 1px dashed rgba(128,128,128,0.3); font-style: italic; background: rgba(0,0,0,0.015); }
    .hud-hide { display: none !important; }
    .collapsed { display: none; }
    .rotate-icon { transform: rotate(180deg); transition: transform 0.3s; }
    `;

    // --- Initialization ---
    const initInterval = setInterval(() => {
        if (typeof SillyTavern !== 'undefined' && typeof $ !== 'undefined' && SillyTavern.chat) {
            clearInterval(initInterval);
            initScript();
        }
    }, 500);

    function initScript() {
        log('═══════════════════════════════════════', 'info');
        log('🚀 Initializing HUD Script v30.1...', 'info');
        log('═══════════════════════════════════════', 'info');
        
        loadSettings();
        log('→ Injecting styles...', 'info');
        injectStyles();
        log('✓ Styles injected', 'success');
        
        log('→ Adding settings menu...', 'info');
        addMenu();
        log('✓ Menu added', 'success');
        
        log('→ Initializing global listeners...', 'info');
        initGlobalListeners();
        log('✓ Global listeners registered', 'success');
        
        log('→ Registering SillyTavern events...', 'info');
        registerSTEvents();
        log('✓ ST events registered', 'success');
        
        setTimeout(() => {
            log('→ Processing initial chat DOM...', 'info');
            processChatDOM('Init');
            log('✓ Initial processing complete', 'success');
            log('═══════════════════════════════════════', 'success');
            log('🎉 HUD Script v30.1 LOADED SUCCESSFULLY!', 'success');
            log('═══════════════════════════════════════', 'success');
            
            if (typeof toastr !== 'undefined') {
                toastr.success('美化终端 v30.1 加载成功！', '终端系统', {timeOut: 3000});
            }
        }, 1000);
    }

    function injectStyles() {
        if (!$('#tri-hud-style').length) $('head').append(`<style id="tri-hud-style">${STYLES}</style>`);
    }

    // --- Event Delegation ---
    function initGlobalListeners() {
        const $chat = $('#chat');
        
        $chat.on('click', '.hud-users-toggle', function(e) {
            e.stopPropagation(); e.preventDefault();
            const $bar = $(this);
            const $scroll = $bar.next('.hud-users-scroll');
            $scroll.toggleClass('collapsed');
            $bar.find('.fa-chevron-down').toggleClass('rotate-icon');
            log('→ Users list toggled', 'info');
        });

        $chat.on('click', '.hud-btn', function(e) {
            e.stopPropagation(); e.preventDefault();
            const fullText = decodeURIComponent($(this).attr('data-full-text'));
            $('#send_textarea').val(fullText).trigger('input').focus();
            log(`→ Option selected: ${fullText}`, 'info');
            if (settings.autoSend) {
                setTimeout(() => $('#send_but').trigger('click'), 100);
                log('→ Auto-sending message...', 'info');
            }
        });

        $chat.on('click', '.hud-refresh-btn', function(e) {
            e.stopPropagation(); e.preventDefault();
            log('═══════════════════════════════════════', 'info');
            log('🔄 Refresh button clicked!', 'warning');
            log('═══════════════════════════════════════', 'info');
            
            const $root = $(this).closest('.hud-root');
            const $small = $root.prev('.hud-hide');
            
            if ($small.length) {
                log('→ Found hidden content, re-processing...', 'info');
                $small.removeAttr('data-hud-processed').removeClass('hud-hide');
                $root.remove();
                setTimeout(() => {
                    processChatDOM('Refresh');
                    log('✓ Refresh complete!', 'success');
                    if (typeof toastr !== 'undefined') {
                        toastr.info('状态栏已刷新', '终端系统', {timeOut: 2000});
                    }
                }, 100);
            } else {
                log('✗ No hidden content found for refresh', 'error');
            }
        });
    }

    // --- DOM Processing ---
    let renderLock = false;
    function processChatDOM(src) {
        if (renderLock) {
            log(`⚠ Render locked, skipping (${src})`, 'warning');
            return;
        }
        renderLock = true;
        setTimeout(() => renderLock = false, 200);

        log(`→ Processing DOM from source: ${src}`, 'info');
        let processedCount = 0;

        $('.mes_text small').each(function() {
            const $el = $(this);
            if ($el.attr('data-hud-processed')) return;
            const text = $el.text();
            if (!text.includes('状态栏') && !text.includes('人物列表') && !text.includes('行动选项')) return;

            log(`→ Found unprocessed <small> element`, 'info');
            $el.attr('data-hud-processed', 'true');
            $el.addClass('hud-hide');

            const data = parseContent(this);
            if (data) {
                let next = $el.next();
                while (next.length && next.hasClass('hud-root')) {
                    next.remove();
                    next = $el.next();
                }
                const $hud = renderHUD(data);
                applySettingsToElement($hud);
                $el.after($hud);
                processedCount++;
                log(`✓ HUD rendered successfully (#${processedCount})`, 'success');
            }
        });

        if (processedCount > 0) {
            log(`✓ Processed ${processedCount} HUD(s) from ${src}`, 'success');
        } else {
            log(`→ No new HUDs to process from ${src}`, 'info');
        }
    }

    // --- Advanced Parser ---
    function parseContent(domEl) {
        log('→ Parsing content...', 'info');
        if (!domEl) return null;
        
        let html = domEl.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/div>/gi, '\n');
        const temp = document.createElement('div'); 
        temp.innerHTML = html;
        const fullText = temp.innerText || temp.textContent;
        
        extractDynamicStats(fullText);
        
        const lines = fullText.split('\n').map(l => l.trim()).filter(l => l);

        let res = { status: [], users: [], options: [], tips: '' };
        let mode = 'none';
        let currentUser = null;
        let lastActiveItem = null;
        let lastActiveType = null;
        let lastUserKey = null;
        let skipJsonLines = false;

        for (let line of lines) {
            if (line.startsWith('{') || skipJsonLines) {
                if (line.includes('}')) skipJsonLines = false;
                else skipJsonLines = true;
                continue;
            }
            
            if (line.includes('状态栏')) { 
                mode = 'status'; 
                lastActiveItem = null; 
                log('→ Entering STATUS mode', 'data');
                continue; 
            }
            if (line.includes('人物列表')) { 
                mode = 'users'; 
                lastActiveItem = null; 
                log('→ Entering USERS mode', 'data');
                continue; 
            }
            if (line.includes('行动选项')) { 
                mode = 'options'; 
                lastActiveItem = null; 
                log('→ Entering OPTIONS mode', 'data');
                continue; 
            }
            if (line.match(/^Tips[:：]/i)) { 
                res.tips = line.replace(/^Tips[:：]\s*/i, ''); 
                log(`→ Found tip: ${res.tips}`, 'data');
                continue; 
            }

            if (mode === 'status') {
                let parts = splitFirst(line, /[:：]/);
                if (parts) {
                    let newItem = { k: parts[0], v: parts[1] };
                    res.status.push(newItem);
                    lastActiveItem = newItem;
                    lastActiveType = 'status';
                } else if (lastActiveItem && lastActiveType === 'status') {
                    lastActiveItem.v += '<br>' + line;
                }
            }
            else if (mode === 'users') {
                if (line.match(/^(名字|Name)[:：]/i)) {
                    if (currentUser) res.users.push(currentUser);
                    currentUser = {};
                    lastActiveItem = null; 
                }

                if (currentUser) {
                    let parts = splitFirst(line, /[:：]/);
                    if (parts) {
                        currentUser[parts[0]] = parts[1];
                        lastUserKey = parts[0];
                        lastActiveType = 'user_kv';
                    } else if (lastUserKey && lastActiveType === 'user_kv') {
                         currentUser[lastUserKey] += '<br>' + line;
                    }
                }
            }
            else if (mode === 'options') {
                if (line === '选项:') continue;
                let match = line.match(/^(\d+)(?:\[(.*?)\])?\s*(.*)$/);
                if (match) res.options.push({ idx: match[1], title: match[2] || '', text: match[3], full: line });
            }
        }
        if (currentUser) res.users.push(currentUser);
        
        log(`✓ Parsed: ${res.status.length} status, ${res.users.length} users, ${res.options.length} options`, 'success');
        
        if (!res.status.length && !res.users.length && !res.options.length) {
            log('✗ No valid content found', 'warning');
            return null;
        }
        return res;
    }

    function splitFirst(str, regex) {
        const match = str.match(regex);
        if (!match) return null;
        return [str.substring(0, match.index).trim(), str.substring(match.index + match[0].length).trim()];
    }

    // --- 生成动态数值条HTML (修改：添加颜色类) ---
    function renderStatBars(characterName) {
        log(`→ Rendering stat bars for: ${characterName}`, 'data');
        
        if (!characterStats[characterName]) {
            log(`→ No stats found for ${characterName}`, 'info');
            return '';
        }

        const stats = characterStats[characterName];
        const statKeys = Object.keys(stats);
        const statCount = statKeys.length;
        
        log(`→ Found ${statCount} attributes for ${characterName}`, 'data');

        if (statCount === 0) return '';

        const layoutClass = statCount <= 2 ? 'single-col' : '';
        
        let html = `<div class="hud-stat-bar-wrapper ${layoutClass}">`;
        
        statKeys.forEach((key, index) => {
            const stat = stats[key];
            const shortLabel = key;
            const value = stat.value;
            const max = stat.max;
            const safeValue = Math.max(0, Math.min(max, value || 0));
            const percentage = (safeValue / max) * 100;
            
            // 为每个数值条分配颜色类（循环使用0-5）
            const colorClass = `color-${index % 6}`;
            
            html += `
                <div class="hud-stat-bar">
                    <div class="hud-stat-bar-label" title="${stat.label}">${shortLabel}</div>
                    <div class="hud-stat-bar-container">
                        <div class="hud-stat-bar-fill ${colorClass}" style="width: ${percentage}%">
                            <div class="hud-stat-bar-text">${safeValue}/${max}</div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        return html;
    }

    // --- Rendering (修改：调整渲染顺序) ---
    function renderHUD(data) {
        log('→ Rendering HUD HTML...', 'info');
        let html = `<div class="hud-root">`;
        
        html += `<div class="hud-refresh-btn" title="刷新状态栏"><i class="fa-solid fa-rotate-right"></i></div>`;

        // 1. Status Bar
        if (data.status.length) {
            html += `<div class="hud-head">`;
            data.status.forEach(s => {
                let icon = 'fa-circle-dot';
                if (s.k.includes('时间') || s.k.includes('日期')) icon = 'fa-clock';
                if (s.k.includes('地点')) icon = 'fa-location-dot';
                html += `<div class="hud-stat-item"><i class="fa-solid ${icon} hud-stat-icon"></i> <span>${s.v}</span></div>`;
            });
            html += `</div>`;
        }

        // 2. Users (修改：数值条放在第一位)
        if (data.users.length) {
            html += `<div class="hud-users-toggle"><span><i class="fa-solid fa-users"></i> 人物列表 (${data.users.length})</span><i class="fa-solid fa-chevron-down"></i></div>`;
            html += `<div class="hud-users-scroll collapsed">`;
            data.users.forEach(u => {
                let name = u['名字'] || u['Name'] || 'Unknown';
                
                // 先渲染数值条（放在第一、二行）
                const statBars = renderStatBars(name);
                
                // 再渲染其他属性
                let props = '';
                for (let k in u) {
                    if (k === '名字' || k === 'Name') continue;
                    let icon = 'fa-caret-right';
                    if (k.includes('内心')) icon = 'fa-brain';
                    if (k.includes('状态')) icon = 'fa-heart-pulse';
                    if (k.includes('穿搭') || k.includes('衣')) icon = 'fa-shirt';
                    if (k.includes('行动')) icon = 'fa-person-running';
                    props += `<div class="hud-kv"><div class="hud-tag-key"><i class="fa-solid ${icon}"></i> ${k}</div><div class="hud-tag-val">${u[k]}</div></div>`;
                }
                
                // 顺序：名字 -> 数值条 -> 其他属性
                html += `<div class="hud-user-card"><div class="hud-user-name">${name}</div>${statBars}${props}</div>`;
            });
            html += `</div>`;
        }

        // 3. Options
        if (data.options.length) {
            html += `<div class="hud-opts-container"><div class="hud-opts-list">`;
            data.options.forEach(o => {
                let titleHtml = o.title ? `<div class="hud-btn-title">${o.title}</div>` : '';
                const safeFull = encodeURIComponent(o.full);
                html += `<div class="hud-btn" data-full-text="${safeFull}"><div class="hud-idx">${o.idx}</div><div class="hud-btn-content">${titleHtml}<div class="hud-btn-text">${o.text}</div></div></div>`;
            });
            html += `</div></div>`;
        }

        if (data.tips) {
            html += `<div class="hud-tips"><i class="fa-solid fa-lightbulb"></i> ${data.tips}</div>`;
        }

        html += `</div>`;
        log('✓ HUD HTML generated', 'success');
        return $(html);
    }

    // --- Settings & Menu ---
    function applySettingsToElement($el) {
        $el.removeClass('hud-theme-luxury hud-theme-floral hud-theme-candy');
        $el.addClass(`hud-theme-${settings.theme}`);
        $el.css('--hud-scale', settings.scale);
        $el.css('font-family', settings.fontFamily || '');
    }

    function addMenu() {
        const extensionsMenu = $('#extensionsMenu');
        const menuItemId = `${SCRIPT_ID}-menu`;
        if (extensionsMenu.length === 0) { 
            setTimeout(addMenu, 1000); 
            return; 
        }
        if ($(`#${menuItemId}`).length > 0) return;

        const btn = $(`<div class="list-group-item flex-container flexGap5 interactable" id="${menuItemId}"><div class="fa-fw fa-solid fa-palette"></div><span>美化终端设置 v30.1</span></div>`);
        btn.on('click', () => {
            const html = `
            <div style="padding:15px; display:flex; flex-direction:column; gap:15px;">
                <h3>终端样式设置 (v30.1) - 彩色数值条</h3>
                <div><label>主题风格:</label><select id="hud-theme-select" class="text_pole" style="width:100%;margin-top:5px;"><option value="luxury" ${settings.theme==='luxury'?'selected':''}>商务奢华 (Dark Gold)</option><option value="floral" ${settings.theme==='floral'?'selected':''}>清新花艺 (Nature)</option><option value="candy" ${settings.theme==='candy'?'selected':''}>糖果波普 (Vibrant)</option></select></div>
                <div><label>字体缩放 (${settings.scale}):</label><input type="range" id="hud-scale-range" min="0.8" max="1.3" step="0.05" value="${settings.scale}" style="width:100%"></div>
                <div><label>自定义字体:</label><input type="text" id="hud-font-input" class="text_pole" placeholder="留空默认" value="${settings.fontFamily}" style="width:100%"></div>
                <label class="checkbox_label"><input type="checkbox" id="hud-auto-send" ${settings.autoSend?'checked':''}> 点击选项自动发送</label>
                <label class="checkbox_label"><input type="checkbox" id="hud-debug" ${settings.debug?'checked':''}> 启用调试信息 (Console)</label>
                <button id="hud-force-refresh" class="menu_button">🔄 强制重绘全部 HUD</button>
                <div style="padding:10px; background:#f5f5f5; border-radius:5px; font-size:0.9em;">
                    <strong>💡 v30.1 更新:</strong><br>
                    • 数值条移至人物卡片第一、二行<br>
                    • 不同属性使用不同颜色区分<br>
                    • 刷新按钮适配移动端（更大更易点击）<br>
                    • 每个主题有独特的配色方案
                </div>
            </div>`;
            SillyTavern.callGenericPopup(html, 1, '', {wide:false});
            setTimeout(() => {
                $('#hud-theme-select').on('change', function() { settings.theme = this.value; saveSettings(); });
                $('#hud-scale-range').on('input', function() { settings.scale = parseFloat(this.value); $(this).prev().text(`字体缩放 (${settings.scale}):`); saveSettings(); });
                $('#hud-font-input').on('change', function() { settings.fontFamily = this.value; saveSettings(); });
                $('#hud-auto-send').on('change', function() { settings.autoSend = this.checked; saveSettings(); });
                $('#hud-debug').on('change', function() { 
                    settings.debug = this.checked; 
                    saveSettings();
                    log('Debug mode: ' + (settings.debug ? 'ENABLED' : 'DISABLED'), 'warning');
                });
                $('#hud-force-refresh').on('click', function() { 
                    log('═══════════════════════════════════════', 'warning');
                    log('🔄 FORCE REFRESH TRIGGERED', 'warning');
                    log('═══════════════════════════════════════', 'warning');
                    
                    characterStats = {};
                    $('.mes_text small').removeAttr('data-hud-processed').removeClass('hud-hide');
                    $('.hud-root').remove();
                    processChatDOM('Manual-Force-Refresh');
                    
                    if (typeof toastr !== 'undefined') {
                        toastr.success('所有状态栏已强制刷新', '终端系统', {timeOut: 2000});
                    }
                });
            }, 100);
        });
        extensionsMenu.append(btn);
    }

    // --- Standard Event Hooks ---
    function registerSTEvents() {
        if (!SillyTavern.eventSource) {
            log('✗ SillyTavern.eventSource not available', 'error');
            return;
        }
        const updateEvents = [
            SillyTavern.eventTypes?.MESSAGE_UPDATED || 'message_updated',
            SillyTavern.eventTypes?.MESSAGE_SWIPED || 'message_swiped',
            SillyTavern.eventTypes?.CHAT_CHANGED || 'chat_changed',
            SillyTavern.eventTypes?.GENERATION_ENDED || 'generation_ended',
            SillyTavern.eventTypes?.MESSAGE_RECEIVED || 'message_received'
        ];
        updateEvents.forEach(evt => {
            if (evt) SillyTavern.eventSource.on(evt, () => {
                log(`→ ST Event triggered: ${evt}`, 'info');
                setTimeout(() => processChatDOM(evt), 200);
            });
        });
        
        const chatContainer = document.querySelector('#chat');
        if (chatContainer) {
            const obs = new MutationObserver((mutations) => {
                if (mutations.some(m => m.addedNodes.length)) {
                    processChatDOM('Mutation');
                }
            });
            obs.observe(chatContainer, { childList: true, subtree: true });
            log('✓ MutationObserver attached to #chat', 'success');
        }
    }
})();
