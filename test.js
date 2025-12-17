// ==UserScript==
// @name         三风格极致UI终端 (Std API) - Enhanced & Multiline & Dynamic Character Stats
// @version      32.1
// @description  Full UI + Premium M/S Bars + Three Refined Themes (Luxury/Floral/Sensual) - [smallbar] Support
// @author       Custom & Gemini & Assistant
// @match        */*
// ==/UserScript==

(function () {
    'use strict';

    const SCRIPT_ID = 'tri_hud_std_v32_premium';
    const SETTINGS_KEY = 'tri_hud_settings_v32';
    
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
        const prefix = '[HUD-v32.1]';
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
    :root { 
        --hud-font-main: 'Segoe UI', 'Microsoft YaHei', sans-serif; 
        --hud-scale: 1; 
        --hud-transition-speed: 0.4s;
        --hud-transition-ease: ease-in-out;
    }
    
    /* 全局平滑过渡 */
    .hud-kv,
    .hud-btn-wrapper,
    .hud-btn-main,
    .hud-stat-item,
    .hud-user-card,
    .hud-send-quick,
    .hud-idx,
    .hud-tag-key,
    .hud-refresh-btn {
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }
    .hud-root {
        font-size: calc(13px * var(--hud-scale)); font-family: var(--hud-font-main);
        margin: 10px 0 20px 0; border-radius: 12px; overflow: hidden; position: relative;
        line-height: 1.5; box-shadow: 0 5px 12px rgba(0, 0, 0, 0.94);
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* 刷新按钮样式 - 精致小巧 */
    .hud-refresh-btn {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        opacity: 0.5;
        transition: all 0.3s ease;
        z-index: 10;
        font-size: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        backdrop-filter: blur(4px);
    }
    .hud-refresh-btn:hover {
        opacity: 1;
        transform: rotate(180deg) scale(1.15);
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
    }
    .hud-refresh-btn:active {
        transform: rotate(180deg) scale(0.9);
    }

    /* 移动端触摸优化 */
    @media (max-width: 768px) {
        .hud-refresh-btn {
            width: 34px;
            height: 34px;
            opacity: 0.7;
            font-size: 14px;
        }
    }

    /* --- Theme 1: Luxury (Business/Gold) - 升级版 --- */
    .hud-theme-luxury {
        --bg: #0a0e12; --c-val: #eceff1; --border: #c4a47c; 
        --c-name: #ffecb3; --c-key: #90a4ae; --c-title: #ffe082; 
        --c-text: #cfd8dc; --c-idx: #c4a47c;
        --m-bar-color: linear-gradient(90deg, rgba(121, 168, 196, 0.6), rgba(66, 94, 117, 0.75));
        --s-bar-color: linear-gradient(90deg, rgba(253, 151, 151, 0.85), rgba(255, 195, 195, 0.77));
        --s-bar-glow: #fff9f984;
        background: linear-gradient(135deg, #0a0e12 0%, #1a1f26 50%, #0f1419 100%);
        color: var(--c-val);
        border-left: 4px solid var(--border);
        border-right: 1px solid rgba(196, 164, 124, 0.3);
        position: relative;
    }
    .hud-theme-luxury::before {
        content: ''; position: absolute; top:0; left:0; right:0; bottom:0; 
        opacity: 0.03;
        background: 
            repeating-linear-gradient(45deg, #000 0px, #000 2px, transparent 2px, transparent 6px),
            url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='3' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        pointer-events: none; z-index: 0;
    }
    .hud-theme-luxury::after {
        content: ''; position: absolute; top:-10%; right:-5%; 
        width: 250px; height: 250px;
        background: radial-gradient(circle, rgba(196, 164, 124, 0.1), transparent 60%);
        pointer-events: none; z-index: 0;
        /*animation: luxury-glow-float 8s ease-in-out infinite;*/
    }
    @keyframes luxury-glow-float {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.1; }
        50% { transform: translate(-20px, -20px) scale(1.1); opacity: 0.15; }
    }
    .hud-theme-luxury .hud-head { 
        border-bottom: 1px solid rgba(196, 164, 124, 0.3); 
        background: rgba(0,0,0,0.3);
        box-shadow: inset 0 -1px 0 rgba(196, 164, 124, 0.15);
        position: relative; z-index: 1;
        backdrop-filter: blur(8px);
    }
    .hud-theme-luxury .hud-user-card {
        background: linear-gradient(145deg, rgba(26, 31, 38, 0.75), rgba(15, 20, 25, 0.85));
        border: 1px solid rgba(196, 164, 124, 0.4);
        box-shadow: 
            inset 0 0 25px rgba(0,0,0,0.5), 
            0 6px 20px rgba(0,0,0,0.4),
            0 0 40px rgba(196, 164, 124, 0.1);
        position: relative;
        backdrop-filter: blur(12px) saturate(120%);
    }
    .hud-theme-luxury .hud-user-card::before {
        content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
        background: linear-gradient(90deg, transparent, rgba(196, 164, 124, 0.6), transparent);
        pointer-events: none;
    }
    .hud-theme-luxury .hud-user-card::after {
        content: ''; position: absolute; top: 12px; right: 12px;
        width: 0; height: 0;
        border-style: solid;
        border-width: 0 20px 20px 0;
        border-color: transparent rgba(212, 175, 55, 0.15) transparent transparent;
        pointer-events: none;
    }
    .hud-theme-luxury .hud-tag-key {
        color: #d4af37 !important; 
        text-transform: uppercase; 
        letter-spacing: 1px;
        font-weight: 700; 
        font-size: 0.85em;
        text-shadow: 0 1px 3px rgba(0,0,0,0.4), 0 0 10px rgba(212, 175, 55, 0.3);
        padding: 2px 0;
        justify-content:flex-end;
    }
    .hud-theme-luxury .hud-tag-val {
        color: #eceff1 !important;
        font-weight: 500;
        text-shadow: 0 1px 2px rgba(0,0,0,0.3);
    }
    .hud-theme-luxury .hud-kv { 
        border-bottom: 1px dashed rgba(255,255,255,0.08);
        transition: background 0.2s ease;
    }
    .hud-theme-luxury .hud-kv:hover {
        background: rgba(196, 164, 124, 0.06);
    }
    .hud-theme-luxury .hud-btn-wrapper { 
        border-bottom: 1px solid rgba(255,255,255,0.04);
        border-left: 3px solid transparent;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .hud-theme-luxury .hud-btn-wrapper:hover { 
        background: linear-gradient(90deg, rgba(196, 164, 124, 0.12), rgba(196, 164, 124, 0.04));
        border-left: 3px solid rgba(212, 175, 55, 0.6);
        box-shadow: 0 2px 12px rgba(212, 175, 55, 0.2);
    }
    .hud-theme-luxury .hud-idx { 
        color: #d4af37; 
        border: 1.5px solid rgba(212, 164, 124, 0.7); 
        background: linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(196, 164, 124, 0.15));
        box-shadow: inset 0 1px 3px rgba(255,255,255,0.15), 0 3px 8px rgba(0,0,0,0.3);
    }
    .hud-theme-luxury .hud-dual-bar-container { 
        background: rgba(0,0,0,0.6); 
        border: 1.5px solid rgba(196, 164, 124, 0.3);
        box-shadow: inset 0 3px 8px rgba(0,0,0,0.5), 0 0 30px rgba(196, 164, 124, 0.15);
    }
    .hud-theme-luxury .hud-dual-bar-center {
        color: rgba(212, 175, 55, 0.9);
        text-shadow: 0 0 12px rgba(212, 175, 55, 1), 0 0 20px rgba(212, 175, 55, 0.6);
    }
    .hud-theme-luxury .hud-refresh-btn { 
        background: rgba(196, 164, 124, 0.35); 
        color: #d4af37; 
        border: 1px solid rgba(212, 175, 55, 0.4);
    }
    .hud-theme-luxury .hud-refresh-btn:hover { 
        background: rgba(196, 164, 124, 0.65); 
        box-shadow: 0 0 20px rgba(212, 175, 55, 0.8);
    }
    .hud-theme-luxury .hud-send-quick { 
        background: rgba(196, 164, 124, 0.06); 
        border-left: 1px solid rgba(196, 164, 124, 0.25);
        transition: all 0.2s ease;
    }
    .hud-theme-luxury .hud-send-quick:hover { 
        background: rgba(196, 164, 124, 0.2);
        box-shadow: inset 0 0 15px rgba(212, 175, 55, 0.25);
    }

    /* --- Theme 2: Floral (Fresh/Nature) - 升级版 --- */
    .hud-theme-floral {
        --bg: #fff; --c-val: #37474f; --c-name: #2e7d32; --c-key: #558b2f; 
        --c-title: #e57373; --c-text: #546e7a; --c-idx: #fff;
        --m-bar-color: linear-gradient(90deg, rgba(195, 219, 238, 0.7), rgba(187, 219, 246, 0.85));
        --s-bar-color: linear-gradient(90deg, rgba(225, 130, 123, 0.85), rgba(255, 174, 163, 0.81));
        --s-bar-glow: #ffc9c9a9;
        background: #fafafa;
        color: var(--c-val); border-radius: 16px;
        border: 1px solid #e0e0e0;
        background-image: 
            radial-gradient(circle at 15% 20%, rgba(232, 245, 233, 0.7) 0%, transparent 45%), 
            radial-gradient(circle at 85% 75%, rgba(225, 245, 254, 0.7) 0%, transparent 50%);
        box-shadow: 0 6px 20px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.9);
        position: relative;
    }
    .hud-theme-floral::before {
        content: '✿'; 
        position: absolute; 
        bottom: 20px; 
        left: 20px;
        font-size: 6em;
        color: rgba(232, 245, 233, 0.3);
        pointer-events: none;
        z-index: 0;
    }
    .hud-theme-floral .hud-head { 
        background: rgba(255,255,255,0.75); 
        backdrop-filter: blur(12px) saturate(150%); 
        border-bottom: 1px dashed #b0bec5;
        box-shadow: 0 2px 6px rgba(0,0,0,0.06);
        position: relative;
        z-index: 1;
    }
    .hud-theme-floral .hud-user-card {
        background: linear-gradient(135deg, rgba(255,255,255,0.98), rgba(250, 252, 255, 0.95));
        border: 1px solid rgba(232, 245, 233, 0.9);
        box-shadow: 
            3px 6px 20px rgba(0,0,0,0.08), 
            inset 0 1px 0 rgba(255,255,255,1),
            0 0 30px rgba(129, 212, 250, 0.1);
        border-radius: 16px;
        position: relative;
    }
    .hud-theme-floral .hud-user-card::after {
        content: ''; position: absolute; bottom: 0; right: 0; 
        width: 90px; height: 90px;
        background: radial-gradient(circle, rgba(232, 245, 233, 0.5), transparent 65%);
        pointer-events: none; border-radius: 0 0 16px 0;
    }
    .hud-theme-floral .hud-tag-key {
        background: linear-gradient(135deg, #f1f8e9, #e8f5e9); 
        padding: 4px 14px; 
        border-radius: 16px;
        color: #33691e !important; 
        box-shadow: 0 3px 6px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.6);
        font-weight: 700; 
        font-size: 0.85em; 
        display: inline-block;
        justify-content:flex-end;
        text-align:right;
    }
    .hud-theme-floral .hud-tag-val {
        color: #37474f !important;
        font-weight: 500;
    }
    .hud-theme-floral .hud-kv { 
        border-bottom: 1px dotted #cfd8dc;
        transition: background 0.2s ease;
    }
    .hud-theme-floral .hud-kv:hover {
        background: rgba(232, 245, 233, 0.35);
    }
    .hud-theme-floral .hud-btn-wrapper { 
        border-radius: 10px; 
        margin: 4px 0;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid transparent;
    }
    .hud-theme-floral .hud-btn-wrapper:hover { 
        background: rgba(255,255,255,0.95); 
        box-shadow: 0 4px 16px rgba(0,0,0,0.12); 
        transform: translateX(3px);
        border-color: rgba(129, 212, 250, 0.4);
    }
    .hud-theme-floral .hud-idx { 
        background: linear-gradient(135deg, #78909c, #607d8b); 
        border-radius: 10px;
        box-shadow: 0 3px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.3);
    }
    .hud-theme-floral .hud-dual-bar-container { 
        background: rgba(224, 224, 224, 0.85); 
        border: 1.5px solid rgba(200, 230, 201, 0.7);
        box-shadow: inset 0 2px 6px rgba(0,0,0,0.18);
    }
    .hud-theme-floral .hud-dual-bar-center {
        color: rgba(85, 139, 47, 0.9);
        text-shadow: 0 0 10px rgba(85, 139, 47, 1), 0 0 18px rgba(85, 139, 47, 0.5);
    }
    .hud-theme-floral .hud-refresh-btn { 
        background: rgba(120, 144, 156, 0.4); 
        color: #558b2f; 
        border: 1px solid rgba(85, 139, 47, 0.35);
    }
    .hud-theme-floral .hud-refresh-btn:hover { 
        background: rgba(120, 144, 156, 0.75); 
        box-shadow: 0 0 16px rgba(85, 139, 47, 0.7);
    }
    .hud-theme-floral .hud-send-quick { 
        background: rgba(120, 144, 156, 0.04); 
        border-left: 1px solid rgba(120, 144, 156, 0.25);
        transition: all 0.2s ease;
    }
    .hud-theme-floral .hud-send-quick:hover { 
        background: rgba(120, 144, 156, 0.18);
        box-shadow: inset 0 0 12px rgba(120, 144, 156, 0.25);
    }

    /* --- Theme 3: Sensual (Dark Romance) - 全新情欲风格 --- */
    .hud-theme-sensual {
        --bg: #1a0a0e; --c-val: #f4d2d9; --border: #d4a574; 
        --c-name: #f4a4b7; --c-key: #f4a4b7; --c-title: #d4a574; 
        --c-text: #f4d2d9; --c-idx: #f4d2d9;
        --m-bar-color: linear-gradient(90deg, rgba(69, 43, 64, 0.85), rgba(98, 74, 94, 0.95));
        --s-bar-color: linear-gradient(90deg, rgba(122, 42, 69, 0.95), rgba(183, 92, 118, 1), rgba(244, 164, 183, 0.95));
        --s-bar-glow: rgba(244, 164, 183, 0.8);
        background: 
            radial-gradient(circle at 15% 20%, rgba(117, 8, 81, 0.12), transparent 40%),
            radial-gradient(circle at 85% 80%, rgba(122, 42, 51, 0.15), transparent 50%),
            linear-gradient(135deg, #1a0a0e 0%, #2d1419 50%, #1f0f14 100%);
        color: var(--c-val);
        border-left: 4px solid rgba(212, 165, 116, 0.5);
        border-right: 1px solid rgba(212, 165, 116, 0.2);
        box-shadow: 0 8px 24px rgba(0,0,0,0.6), 0 0 60px rgba(117, 8, 81, 0.2);
        position: relative;
    }
    .hud-theme-sensual::before {
        content: ''; position: absolute; top:0; left:0; right:0; bottom:0; 
        opacity: 0.03;
        background: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='velvet'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='2' numOctaves='3' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23velvet)'/%3E%3C/svg%3E");
        pointer-events: none; z-index: 0;
    }
    .hud-theme-sensual::after {
        content: ''; position: absolute; top: 0; right: 0;
        width: 300px; height: 300px;
        background: radial-gradient(circle, rgba(117, 8, 81, 0.15), transparent 60%);
        pointer-events: none; z-index: 0;
        /*animation: sensual-ambient 10s ease-in-out infinite;*/
    }
    @keyframes sensual-ambient {
        0%, 100% { transform: translate(0, 0); opacity: 0.15; }
        50% { transform: translate(-30px, 30px); opacity: 0.25; }
    }
    .hud-theme-sensual .hud-head { 
        border-bottom: 1px solid rgba(212, 165, 116, 0.25); 
        background: rgba(0,0,0,0.4);
        box-shadow: inset 0 -1px 0 rgba(244, 164, 183, 0.1);
        position: relative; z-index: 1;
        backdrop-filter: blur(10px) saturate(130%);
    }
    .hud-theme-sensual .hud-user-card {
        background: linear-gradient(145deg, rgba(45, 20, 25, 0.85), rgba(26, 10, 14, 0.95));
        border: 1px solid rgba(212, 165, 116, 0.35);
        box-shadow: 
            0 10px 40px rgba(0, 0, 0, 0.7),
            inset 0 1px 0 rgba(244, 164, 183, 0.15),
            0 0 50px rgba(117, 8, 81, 0.25);
        position: relative;
        backdrop-filter: blur(15px) saturate(150%);
    }
    .hud-theme-sensual .hud-user-card::before {
        content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
        background: linear-gradient(90deg, transparent, rgba(244, 164, 183, 0.4), transparent);
        pointer-events: none;
    }
    .hud-theme-sensual .hud-user-card::after {
        content: '❦'; 
        position: absolute; 
        bottom: 10px; 
        right: 10px;
        font-size: 2em;
        color: rgba(212, 165, 116, 0.15);
        text-shadow: 0 0 20px rgba(117, 8, 81, 0.4);
        pointer-events: none;
    }
    .hud-theme-sensual .hud-user-name {
        background: linear-gradient(135deg, rgba(117, 8, 81, 0.4), rgba(122, 42, 51, 0.3));
        border-bottom: 2px solid transparent;
        border-image: linear-gradient(90deg, transparent, rgba(212, 165, 116, 0.6), transparent) 1;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8), 0 0 20px rgba(244, 164, 183, 0.4);
        color: #f4d2d9;
        letter-spacing: 2px;
        font-weight: 800;
        padding: 8px 12px;
        border-radius: 8px 8px 0 0;
    }
    .hud-theme-sensual .hud-tag-key {
        background: linear-gradient(135deg, rgba(117, 8, 81, 0.35), rgba(74, 57, 71, 0.45));
        color: #f4a4b7 !important;
        padding: 4px 14px;
        border-radius: 18px;
        border: 1px solid rgba(212, 165, 116, 0.3);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(244, 164, 183, 0.25);
        font-weight: 700;
        font-size: 0.85em;
        text-transform: uppercase;
        letter-spacing: 1px;
        display: inline-block;
        justify-content: flex-end; 
        text-align: right; 
    }
    .hud-theme-sensual .hud-tag-val {
        color: #f4d2d9 !important;
        font-weight: 500;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
    }
    .hud-theme-sensual .hud-kv { 
        border-bottom: 1px dashed rgba(212, 165, 116, 0.15);
        transition: background 0.2s ease;
    }
    .hud-theme-sensual .hud-kv:hover {
        background: rgba(117, 8, 81, 0.1);
    }
    .hud-theme-sensual .hud-btn-wrapper { 
        border-bottom: 1px solid rgba(212, 165, 116, 0.08);
        border-left: 3px solid transparent; 
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .hud-theme-sensual .hud-btn-wrapper:hover { 
        background: linear-gradient(90deg, rgba(117, 8, 81, 0.15), rgba(122, 42, 51, 0.1));
        border-left: 3px solid rgba(212, 165, 116, 0.6);
        box-shadow: 0 4px 20px rgba(117, 8, 81, 0.3), inset 0 0 20px rgba(244, 164, 183, 0.05);
        transform: translateX(4px);
    }
    .hud-theme-sensual .hud-idx {
        background: linear-gradient(135deg, rgba(122, 42, 51, 0.8), rgba(117, 8, 81, 0.9));
        border: 2px solid rgba(212, 165, 116, 0.5);
        box-shadow: 
            0 4px 12px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(244, 164, 183, 0.3),
            0 0 20px rgba(117, 8, 81, 0.4);
        color: #f4d2d9;
    }
    .hud-theme-sensual .hud-dual-bar-container { 
        background: rgba(0, 0, 0, 0.6);
        border: 1.5px solid rgba(212, 165, 116, 0.3);
        box-shadow: inset 0 3px 8px rgba(0, 0, 0, 0.8), 0 0 30px rgba(117, 8, 81, 0.3);
    }
    .hud-theme-sensual .hud-dual-bar-center {
        color: rgba(212, 165, 116, 0.9);
        text-shadow: 0 0 12px rgba(212, 165, 116, 1), 0 0 20px rgba(212, 165, 116, 0.6);
    }
    .hud-theme-sensual .hud-refresh-btn { 
        background: rgba(122, 42, 51, 0.4);
        border: 1.5px solid rgba(212, 165, 116, 0.4);
        color: #f4a4b7;
        backdrop-filter: blur(8px);
    }
    .hud-theme-sensual .hud-refresh-btn:hover { 
        background: rgba(122, 42, 51, 0.7);
        box-shadow: 0 0 20px rgba(244, 164, 183, 0.7), 0 0 40px rgba(117, 8, 81, 0.5);
    }
    .hud-theme-sensual .hud-send-quick { 
        background: rgba(122, 42, 51, 0.08);
        border-left: 1px solid rgba(212, 165, 116, 0.25);
        color: #f4a4b7;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .hud-theme-sensual .hud-send-quick:hover { 
        background: rgba(122, 42, 51, 0.25);
        box-shadow: inset 0 0 20px rgba(183, 92, 118, 0.3), 0 0 15px rgba(244, 164, 183, 0.5);
        transform: scale(1.1);
    }

    /* --- 高级双向数值条 M/S --- */
    .hud-merged-stat-wrapper {
        margin-bottom: 14px;
        padding-bottom: 14px;
        border-bottom: 1px solid rgba(128,128,128,0.2);
    }
    .hud-dual-bar-container {
        height: 32px;
        border-radius: 16px;
        overflow: hidden;
        position: relative;
        display: flex;
    }
    .hud-dual-bar-m {
        height: 100%;
        background: var(--m-bar-color);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.9em;
        font-weight: 900;
        color: rgba(255,255,255,0.95);
        text-shadow: 
            0 1px 3px rgba(0,0,0,0.5), 
            0 0 10px rgba(255,255,255,0.4);
        transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        letter-spacing: 1.5px;
        border-right: 1px solid rgba(0,0,0,0.3);
        box-shadow: inset 2px 0 10px rgba(0, 0, 0, 0.4);
    }
    .hud-dual-bar-s {
        height: 100%;
        background: var(--s-bar-color);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.9em;
        font-weight: 900;
        color: rgba(255,255,255,0.98);
        text-shadow: 
            0 1px 3px rgba(0,0,0,0.6), 
            0 0 12px rgba(255,255,255,0.5);
        transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        letter-spacing: 1.5px;
        box-shadow: 
            0 0 20px var(--s-bar-glow), 
            0 0 35px var(--s-bar-glow),
            0 0 50px var(--s-bar-glow),
            inset 0 2px 6px rgba(255,255,255,0.4),
            inset 0 -3px 8px rgba(0,0,0,0.3);
        /*animation: premium-glow-pulse 2.5s ease-in-out infinite;*/
    }
    @keyframes premium-glow-pulse {
        0%, 100% { 
            filter: brightness(1) saturate(100%);
            box-shadow: 
                0 0 20px var(--s-bar-glow), 
                0 0 35px var(--s-bar-glow),
                0 0 50px var(--s-bar-glow),
                inset 0 2px 6px rgba(255,255,255,0.4),
                inset 0 -3px 8px rgba(0,0,0,0.3);
        }
        50% { 
            filter: brightness(1.25) saturate(130%);
            box-shadow: 
                0 0 30px var(--s-bar-glow), 
                0 0 50px var(--s-bar-glow),
                0 0 70px var(--s-bar-glow),
                0 0 90px rgba(255,255,255,0.3),
                inset 0 2px 8px rgba(255,255,255,0.6),
                inset 0 -3px 10px rgba(0,0,0,0.4);
        }
    }
    .hud-dual-bar-center {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        font-size: 0.7em;
        font-weight: 900;
        z-index: 10;
        pointer-events: none;
    }

    /* --- 人物属性横向布局（10px间距） --- */
    .hud-kv {
        display: grid;
        grid-template-columns: 70px 1fr;
        gap: 20px;
        align-items: center;
        padding: 8px 0;
        margin-bottom: -10px;
        min-heigh: 20px;
    }
    .hud-kv:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 14px;
    }
    .hud-tag-key {
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        justify-content:flex-end;
        width:100%;
        text-align:right;
    }
    .hud-tag-val {
        font-size: 0.95em;
        line-height: 1.5;
        opacity: 0.95;
        white-space: pre-wrap;
        text-align: left;
        word-break: break-word;
        display:flex;
        align-items:center;
    }

    /* --- 行动选项优化布局 --- */
    .hud-opts-container {
        width: 100%;
        overflow-x: auto;
        padding: 6px 16px;
        scrollbar-width: thin;
    }
    .hud-opts-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 400px;
        width: 100%;
    }
    .hud-btn-wrapper {
        display: flex;
        align-items: stretch;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
        width: 100%;
        min-height: 36px;
        border-radius: 8px;
        overflow: hidden;
    }
    .hud-btn-left {
        flex: 0 0 75px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 8px 6px;
    }
    .hud-idx {
        font-weight: 900;
        font-size: 1.15em;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: 10px;
        transition: all 0.2s ease;
    }
    .hud-btn-title-small {
        font-weight: 700;
        font-size: 0.7em;
        text-align: center;
        line-height: 1.2;
        opacity: 0.85;
        max-width: 100%;
        word-break: break-word;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .hud-btn-main {
        flex: 1;
        display: flex;
        align-items: center;
        padding: 6px 10px;
        font-size: 0.95em;
        line-height: 1.3;
        transition: all 0.2s ease;
    }
    .hud-send-quick {
        flex: 0 0 52px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.35;
        transition: all 0.25s ease;
        font-size: 1.15em;
        cursor: pointer;
    }
    .hud-send-quick:hover {
        opacity: 1;
        transform: scale(1.15);
    }
    .hud-send-quick:active {
        transform: scale(0.95);
    }

    @media (max-width: 768px) {
        .hud-btn-left {
            flex: 0 0 70px;
        }
        .hud-send-quick {
            flex: 0 0 58px;
            opacity: 0.5;
        }
        .hud-idx {
            width: 38px;
            height: 38px;
            font-size: 1.2em;
        }
        .hud-btn-title-small {
            font-size: 0.65em;
        }
    }

    /* --- General Layout --- */
    .hud-head {
        padding: 12px 18px;
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        font-size: 0.9em;
        align-items: center;
        position: relative;
        z-index: 1;
    }
    .hud-stat-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
        padding: 4px 8px;
        border-radius: 6px;
        transition: background 0.2s ease;
    }
    .hud-stat-item:hover {
        background: rgba(255,255,255,0.05);
    }
    
    .hud-users-toggle {
        padding: 10px 18px;
        font-size: 0.95em;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(0,0,0,0.03);
        font-weight: 700;
        cursor: pointer;
        user-select: none;
        border-top: 1px solid rgba(0,0,0,0.05);
        border-bottom: 1px solid rgba(0,0,0,0.05);
        transition: background 0.2s ease;
        position: relative;
        z-index: 1;
    }
    .hud-users-toggle:hover {
        background: rgba(0,0,0,0.05);
    }
    .hud-users-scroll {
        display: flex;
        overflow-x: auto;
        gap: 16px;
        padding: 16px;
        scrollbar-width: thin;
        position: relative;
        z-index: 1;
    }
    .hud-user-card {
        flex: 0 0 290px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        border-radius: 12px;
    }
    .hud-user-card:hover {
        transform: translateY(-6px) scale(1.01);
    }
    
    .hud-user-name {
        font-weight: 800;
        font-size: 1.3em;
        margin-bottom: 8px;
        border-bottom: 2px solid rgba(0,0,0,0.05);
        padding-bottom: 8px;
        letter-spacing: 0.5px;
    }
    
    .hud-tips {
        padding: 12px 18px;
        font-size: 0.9em;
        opacity: 0.85;
        border-top: 1px dashed rgba(128,128,128,0.3);
        font-style: italic;
        background: rgba(0,0,0,0.02);
        line-height: 1.6;
        position: relative;
        z-index: 1;
    }
    .hud-hide {
        display: none !important;
    }
    .collapsed {
        display: none;
    }
    .rotate-icon {
        transform: rotate(180deg);
        transition: transform 0.3s ease;
    }
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
        log('🚀 Initializing HUD Script v32.1...', 'info');
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
            log('🎉 HUD Script v32.1 LOADED SUCCESSFULLY!', 'success');
            log('═══════════════════════════════════════', 'success');
            
            if (typeof toastr !== 'undefined') {
                toastr.success('美化终端 v32.1 加载成功 - [smallbar]标记支持！', '终端系统', {timeOut: 3000});
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

        $chat.on('click', '.hud-btn-main', function(e) {
            e.stopPropagation(); e.preventDefault();
            const fullText = decodeURIComponent($(this).closest('.hud-btn-wrapper').attr('data-full-text'));
            $('#send_textarea').val(fullText).trigger('input').focus();
            log(`→ Option selected: ${fullText}`, 'info');
            if (settings.autoSend) {
                setTimeout(() => $('#send_but').trigger('click'), 100);
                log('→ Auto-sending message...', 'info');
            }
        });

        $chat.on('click', '.hud-send-quick', function(e) {
            e.stopPropagation(); e.preventDefault();
            const fullText = decodeURIComponent($(this).closest('.hud-btn-wrapper').attr('data-full-text'));
            $('#send_textarea').val(fullText).trigger('input');
            setTimeout(() => $('#send_but').trigger('click'), 100);
            log(`→ Quick send: ${fullText}`, 'info');
        });

        $chat.on('click', '.hud-refresh-btn', function(e) {
            e.stopPropagation(); e.preventDefault();
            log('═══════════════════════════════════════', 'info');
            log('🔄 Refresh button clicked!', 'warning');
            log('═══════════════════════════════════════', 'info');
            
            const $root = $(this).closest('.hud-root');
            const hudId = $root.attr('data-hud-id');
            
            if (hudId) {
                const $hidden = $(`.hud-hidden-source[data-hud-id="${hudId}"]`);
                if ($hidden.length) {
                    log('→ Found hidden source, re-processing...', 'info');
                    $hidden.removeAttr('data-hud-processed');
                    $root.remove();
                    setTimeout(() => {
                        processChatDOM('Refresh');
                        log('✓ Refresh complete!', 'success');
                        if (typeof toastr !== 'undefined') {
                            toastr.info('状态栏已刷新', '终端系统', {timeOut: 2000});
                        }
                    }, 100);
                } else {
                    log('✗ No hidden source found for refresh', 'error');
                }
            }
        });
    }

    // --- DOM Processing (Modified for [smallbar] tags) ---
    let renderLock = false;
    let hudIdCounter = 0;
    
    function processChatDOM(src) {
        if (renderLock) {
            log(`⚠ Render locked, skipping (${src})`, 'warning');
            return;
        }
        renderLock = true;
        setTimeout(() => renderLock = false, 200);

        log(`→ Processing DOM from source: ${src}`, 'info');
        let processedCount = 0;

        // 遍历所有消息文本容器
        $('.mes_text').each(function() {
            const $container = $(this);
            let html = $container.html();
            
            // 正则匹配所有 [smallbar]...[/smallbar] 标记
            const regex = /\[smallbar\]([\s\S]*?)\[\/smallbar\]/gi;
            let matches = [];
            let match;
            
            // 收集所有匹配
            while ((match = regex.exec(html)) !== null) {
                matches.push({
                    fullMatch: match[0],
                    innerContent: match[1],
                    index: match.index
                });
            }
            
            if (matches.length === 0) return;
            
            // 倒序处理（从后往前），避免索引错位
            matches.reverse().forEach(matchData => {
                const uniqueId = `hud-${hudIdCounter++}`;
                
                // 检查是否已处理
                if ($container.find(`.hud-hidden-source[data-hud-id="${uniqueId}"]`).length > 0) {
                    return;
                }
                
                // 检查此位置是否已有隐藏标记
                const checkHtml = $container.html();
                if (checkHtml.includes(`data-hud-source-index="${matchData.index}"`)) {
                    return;
                }
                
                log(`→ Found [smallbar] block at index ${matchData.index}`, 'info');
                
                // 创建临时容器解析内容
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = matchData.innerContent;
                
                const data = parseContent(tempDiv);
                
                if (data) {
                    const $hud = renderHUD(data, uniqueId);
                    applySettingsToElement($hud);
                    
                    // 创建隐藏的源内容标记
                    const hiddenSource = `<span class="hud-hidden-source hud-hide" data-hud-id="${uniqueId}" data-hud-processed="true" data-hud-source-index="${matchData.index}">${matchData.fullMatch}</span>`;
                    
                    // 替换原始标记
                    let currentHtml = $container.html();
                    const beforeMatch = currentHtml.substring(0, matchData.index);
                    const afterMatch = currentHtml.substring(matchData.index + matchData.fullMatch.length);
                    
                    $container.html(beforeMatch + hiddenSource + afterMatch);
                    
                    // 插入HUD
                    $container.find(`.hud-hidden-source[data-hud-id="${uniqueId}"]`).after($hud);
                    
                    processedCount++;
                    log(`✓ HUD rendered successfully (#${processedCount}) with ID: ${uniqueId}`, 'success');
                }
            });
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

    // --- 生成合并双向数值条 M/S（修正：根据键名识别）---
    function renderMergedStatBar(characterName) {
        log(`→ Rendering merged stat bar for: ${characterName}`, 'data');
        
        if (!characterStats[characterName]) {
            log(`→ No stats found for ${characterName}`, 'info');
            return '';
        }

        const stats = characterStats[characterName];
        const statKeys = Object.keys(stats);
        
        if (statKeys.length < 2) {
            log(`→ Less than 2 stats, skipping merged bar for ${characterName}`, 'info');
            return '';
        }

        // 修正：根据键名判断M和S
        let mKey = null;
        let sKey = null;
        
        for (let key of statKeys) {
            const upperKey = key.toUpperCase();
            if (upperKey.includes('M') && !upperKey.includes('S')) {
                mKey = key;
            } else if (upperKey.includes('S') && !upperKey.includes('M')) {
                sKey = key;
            }
        }
        
        // 如果没找到，使用前两个
        if (!mKey) mKey = statKeys[0];
        if (!sKey) sKey = statKeys[1];
        
        const mStat = stats[mKey];
        const sStat = stats[sKey];
        
        const mValue = Math.max(0, Math.min(mStat.max, mStat.value || 0));
        const sValue = Math.max(0, Math.min(sStat.max, sStat.value || 0));
        
        // 计算显示宽度
        const total = mValue + sValue;
        const mWidth = total > 0 ? (mValue / total) * 100 : 50;
        const sWidth = total > 0 ? (sValue / total) * 100 : 50;
        
        log(`→ ${mKey}(M): ${mValue}/${mStat.max} (${mWidth.toFixed(1)}%), ${sKey}(S): ${sValue}/${sStat.max} (${sWidth.toFixed(1)}%)`, 'data');
        
        // 仅显示字母
        let html = `
            <div class="hud-merged-stat-wrapper">
                <div class="hud-dual-bar-container">
                    <div class="hud-dual-bar-s" style="width: ${sWidth}%">
                        <span>S</span>
                    </div>
                    <div class="hud-dual-bar-m" style="width: ${mWidth}%">
                        <span>M</span>
                    </div>
                    <div class="hud-dual-bar-center" style="left: ${sWidth}%;">○</div>
                </div>
            </div>
        `;
        
        return html;
    }

    // --- Rendering ---
    function renderHUD(data, hudId) {
        log('→ Rendering HUD HTML...', 'info');
        let html = `<div class="hud-root" data-hud-id="${hudId}">`;
        
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

        // 2. Users
        if (data.users.length) {
            html += `<div class="hud-users-toggle"><span><i class="fa-solid fa-users"></i> 人物列表 (${data.users.length})</span><i class="fa-solid fa-chevron-down"></i></div>`;
            html += `<div class="hud-users-scroll collapsed">`;
                // 新增：按名字排序
                const sortedUsers = data.users.sort((a, b) => {
                const nameA = a['名字'] || a['Name'] || '';
                const nameB = b['名字'] || b['Name'] || '';
                return nameA.localeCompare(nameB, 'zh-CN');  // 中文拼音排序
            });
                sortedUsers.forEach(u => {
                let name = u['名字'] || u['Name'] || 'Unknown';
                
                // 先渲染合并数值条
                const mergedBar = renderMergedStatBar(name);
                
                // 再渲染其他属性
                let props = '';
                for (let k in u) {
                    if (k === '名字' || k === 'Name') continue;
                    let icon = 'fa-caret-right';
                    if (k.includes('内心')) icon = 'fa-brain';
                    if (k.includes('状态')) icon = 'fa-heart-pulse';
                    if (k.includes('穿搭') || k.includes('衣')) icon = 'fa-shirt';
                    if (k.includes('行动')) icon = 'fa-person-running';
                    if (k.includes('身高')) icon = 'fa-person';
                    if (k.includes('性器')) icon = 'fa-droplet';
                    if (k.includes('胸部')) icon = 'fa-egg';
                    if (k.includes('肛门')) icon = 'fa-circle-dot';
                    props += `<div class="hud-kv"><div class="hud-tag-key"><i class="fa-solid ${icon}"></i> ${k}</div><div class="hud-tag-val">${u[k]}</div></div>`;
                }
                
                html += `<div class="hud-user-card"><div class="hud-user-name">${name}</div>${mergedBar}${props}</div>`;
            });
            html += `</div>`;
        }

        // 3. Options
        if (data.options.length) {
            html += `<div class="hud-opts-container"><div class="hud-opts-list">`;
            data.options.forEach(o => {
                const safeFull = encodeURIComponent(o.full);
                let titleHtml = o.title ? `<div class="hud-btn-title-small">${o.title}</div>` : '';
                html += `
                    <div class="hud-btn-wrapper" data-full-text="${safeFull}">
                        <div class="hud-btn-left">
                            <div class="hud-idx">${o.idx}</div>
                            ${titleHtml}
                        </div>
                        <div class="hud-btn-main">${o.text}</div>
                        <div class="hud-send-quick" title="快速发送"><i class="fa-solid fa-paper-plane"></i></div>
                    </div>
                `;
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
        $el.removeClass('hud-theme-luxury hud-theme-floral hud-theme-candy hud-theme-sensual');
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

        const btn = $(`<div class="list-group-item flex-container flexGap5 interactable" id="${menuItemId}"><div class="fa-fw fa-solid fa-palette"></div><span>美化终端设置 v32.1</span></div>`);
        btn.on('click', () => {
            const html = `
            <div style="padding:15px; display:flex; flex-direction:column; gap:15px;">
                <h3>终端样式设置 (v32.1) - [smallbar]标记支持</h3>
                <div><label>主题风格:</label><select id="hud-theme-select" class="text_pole" style="width:100%;margin-top:5px;"><option value="luxury" ${settings.theme==='luxury'?'selected':''}>商务奢华 (Dark Gold)</option><option value="floral" ${settings.theme==='floral'?'selected':''}>清新花艺 (Nature)</option><option value="sensual" ${settings.theme==='sensual'?'selected':''}>暗夜情欲 (Dark Romance)</option></select></div>
                <div><label>字体缩放 (${settings.scale}):</label><input type="range" id="hud-scale-range" min="0.8" max="1.3" step="0.05" value="${settings.scale}" style="width:100%"></div>
                <div><label>自定义字体:</label><input type="text" id="hud-font-input" class="text_pole" placeholder="留空默认" value="${settings.fontFamily}" style="width:100%"></div>
                <label class="checkbox_label"><input type="checkbox" id="hud-auto-send" ${settings.autoSend?'checked':''}> 点击选项自动发送</label>
                <label class="checkbox_label"><input type="checkbox" id="hud-debug" ${settings.debug?'checked':''}> 启用调试信息 (Console)</label>
                <button id="hud-force-refresh" class="menu_button">🔄 强制重绘所有状态栏</button>
                <div style="padding:12px; background:linear-gradient(135deg, #1a0a0e, #2d1419); border-radius:8px; font-size:0.9em; border-left:4px solid #d4a574; color:#f4d2d9;">
                    <strong>🌹 v32.1 更新:</strong><br>
                    • <strong>[smallbar]标记支持</strong>：替代&lt;small&gt;标签<br>
                    • <strong>使用方法</strong>：用[smallbar]...[/smallbar]包裹内容<br>
                    • <strong>M/S识别</strong>：根据键名智能判断<br>
                    • <strong>数值条升级</strong>：32px高度+超强发光脉冲<br>
                    • <strong>三大主题</strong>：Luxury/Floral/Sensual<br>
                    • <strong>完美交互</strong>：流畅动画+多层阴影<br>
                    • 移动端触控优化
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
                    hudIdCounter = 0;
                    $('.hud-hidden-source').removeAttr('data-hud-processed');
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
