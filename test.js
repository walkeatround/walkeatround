// ==UserScript==
// @name         三风格极致UI终端 (Std API) - Enhanced & Multiline & Character Stats
// @version      30.0
// @description  Full UI (v27) + Multiline Support + Dynamic Character Stats with JSON Parse + Refresh Button
// @author       Custom & Gemini & Enhanced
// @match        */*
// ==/UserScript==

(function () {
    'use strict';

    const SCRIPT_ID = 'tri_hud_std_v30_stats';
    const SETTINGS_KEY = 'tri_hud_settings_v26';
    
    let settings = {
        autoSend: false,
        theme: 'luxury', 
        scale: 1.0,
        fontFamily: '',
        debug: true  // 默认开启debug
    };

    // 存储从JSON提取的角色统计数据
    let characterStats = {};

    // --- Utilities ---
    function loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
            if (saved) settings = { ...settings, ...saved };
            log('[设置] 加载成功');
        } catch(e) { 
            console.error('[设置] 加载失败:', e); 
        }
    }

    function saveSettings() {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        $('.hud-root').each(function() { applySettingsToElement($(this)); });
        log('[设置] 保存成功');
    }

    function log(msg, data) {
        if (settings.debug) {
            if (data !== undefined) {
                console.log(`[HUD-Debug] ${msg}`, data);
            } else {
                console.log(`[HUD-Debug] ${msg}`);
            }
        }
    }

    // --- JSON解析工具函数 ---
    function extractJSONFromText(text) {
        log('[JSON解析] 开始提取JSON数据');
        try {
            // 尝试匹配JSON对象 {...}
            const jsonMatch = text.match(/\{[\s\S]*?".*?"[\s\S]*?\}/);
            if (jsonMatch) {
                const jsonStr = jsonMatch[0];
                log('[JSON解析] 找到JSON字符串', jsonStr);
                const parsed = JSON.parse(jsonStr);
                log('[JSON解析] 解析成功', parsed);
                return parsed;
            }
            log('[JSON解析] 未找到JSON数据');
            return null;
        } catch(e) {
            console.error('[JSON解析] 解析失败:', e);
            return null;
        }
    }

    // --- 处理MVU变量格式 ---
    const MvuUtils = {
        isMvuVar: (v) => Array.isArray(v) && v.length >= 2 && typeof v[1] === 'string',
        safeFormat: (val) => {
            if (val === null || val === undefined) return 0;
            if (typeof val === 'number') return val;
            if (typeof val === 'string') return parseFloat(val) || 0;
            if (Array.isArray(val) && val.length >= 1) {
                // MVU格式 [value, description]
                return MvuUtils.safeFormat(val[0]);
            }
            return 0;
        },
        getDescription: (val) => {
            if (Array.isArray(val) && val.length >= 2 && typeof val[1] === 'string') {
                return val[1];
            }
            return '';
        }
    };

    // --- 从JSON提取角色统计数据 ---
    function parseCharacterStatsFromJSON(jsonData) {
        log('[数据提取] 开始处理JSON数据', jsonData);
        const stats = {};
        
        if (!jsonData || typeof jsonData !== 'object') {
            log('[数据提取] 无效的JSON数据');
            return stats;
        }
        
        // 遍历每个角色
        for (let charName in jsonData) {
            const charData = jsonData[charName];
            if (typeof charData !== 'object') continue;
            
            stats[charName] = {};
            log(`[数据提取] 处理角色: ${charName}`);
            
            // 遍历角色的所有属性
            for (let attrKey in charData) {
                const attrValue = charData[attrKey];
                const numValue = MvuUtils.safeFormat(attrValue);
                const description = MvuUtils.getDescription(attrValue);
                
                stats[charName][attrKey] = {
                    value: numValue,
                    description: description,
                    max: 100  // 默认最大值，可以从description中提取
                };
                
                // 尝试从描述中提取最大值
                if (description) {
                    const maxMatch = description.match(/\(0-(\d+)\)/);
                    if (maxMatch) {
                        stats[charName][attrKey].max = parseInt(maxMatch[1]);
                    }
                }
                
                log(`  属性 ${attrKey}: ${numValue}/${stats[charName][attrKey].max} - ${description}`);
            }
        }
        
        log('[数据提取] 完成，提取到的数据:', stats);
        return stats;
    }

    // --- CSS (Full v27 Style + Character Stats Bars + Refresh Button) ---
    const STYLES = `
    :root { --hud-font-main: 'Segoe UI', 'Microsoft YaHei', sans-serif; --hud-scale: 1; }
    .hud-root {
        font-size: calc(13px * var(--hud-scale)); font-family: var(--hud-font-main);
        margin: 10px 0 20px 0; border-radius: 12px; overflow: hidden; position: relative;
        line-height: 1.5; box-shadow: 0 6px 18px rgba(0,0,0,0.15);
        pointer-events: auto; z-index: 5; user-select: text;
        transition: all 0.3s ease;
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
    .hud-theme-luxury .hud-stat-bar-fill { background: linear-gradient(90deg, #d4af37, #c4a47c); }
    .hud-theme-luxury .hud-refresh-btn { color: #c4a47c; }
    .hud-theme-luxury .hud-refresh-btn:hover { color: #d4af37; background: rgba(196, 164, 124, 0.1); }

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
    .hud-theme-floral .hud-stat-bar-fill { background: linear-gradient(90deg, #66bb6a, #43a047); }
    .hud-theme-floral .hud-refresh-btn { color: #558b2f; }
    .hud-theme-floral .hud-refresh-btn:hover { color: #33691e; background: rgba(85, 139, 47, 0.1); }

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
    .hud-theme-candy .hud-stat-bar-fill { background: linear-gradient(90deg, #ff4081, #f50057); }
    .hud-theme-candy .hud-refresh-btn { color: #c51162; }
    .hud-theme-candy .hud-refresh-btn:hover { color: #880e4f; background: rgba(197, 17, 98, 0.1); }

    /* --- Character Stat Bar Styles (增强版) --- */
    .hud-stat-bar-wrapper {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px 12px;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(128,128,128,0.2);
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
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .hud-stat-bar-label-text {
        flex: 1;
    }
    .hud-stat-bar-label-value {
        font-size: 0.9em;
        opacity: 0.7;
    }
    .hud-stat-bar-container {
        width: 100%;
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
        color: rgba(0,0,0,0.6);
        text-shadow: 0 0 3px rgba(255,255,255,0.9);
    }

    /* --- Refresh Button Styles --- */
    .hud-refresh-btn {
        position: absolute;
        top: 8px;
        right: 12px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        opacity: 0.4;
        transition: all 0.3s ease;
        z-index: 10;
        font-size: 0.9em;
    }
    .hud-refresh-btn:hover {
        opacity: 1;
        transform: rotate(180deg);
    }
    .hud-refresh-btn i {
        pointer-events: none;
    }

    /* --- General Layout --- */
    .hud-head { padding: 10px 16px; display: flex; flex-wrap: wrap; gap: 15px; font-size: 0.9em; align-items: center; position: relative; }
    .hud-stat-item { display: flex; align-items: center; gap: 8px; font-weight: 500; }
    
    .hud-users-toggle { 
        padding: 8px 16px; font-size: 0.9em; display: flex; justify-content: space-between; 
        background: rgba(0,0,0,0.03); font-weight: bold; cursor: pointer; user-select: none; 
        border-top: 1px solid rgba(0,0,0,0.05); border-bottom: 1px solid rgba(0,0,0,0.05);
    }
    .hud-users-scroll { display: flex; overflow-x: auto; gap: 14px; padding: 14px 16px; scrollbar-width: thin; }
    .hud-user-card { flex: 0 0 280px; padding: 14px; display: flex; flex-direction: column; gap: 8px; transition: transform 0.2s; }
    .hud-user-card:hover { transform: translateY(-2px); }
    
    /* User Details Refined */
    .hud-user-name { font-weight: 800; font-size: 1.25em; margin-bottom: 6px; border-bottom: 2px solid rgba(0,0,0,0.05); padding-bottom: 6px; }
    .hud-kv { display: flex; flex-direction: column; gap: 4px; padding-bottom: 8px; margin-bottom: 8px; }
    .hud-kv:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .hud-tag-key { font-size: 1.05em; opacity: 0.95; font-weight: bold; display: flex; align-items: center; gap: 6px; }
    .hud-tag-val { font-size: 1em; line-height: 1.4; padding-left: 2px; opacity: 0.95; white-space: pre-wrap; }

    /* Options Refined */
    .hud-opts-container { width: 100%; overflow-x: auto; padding: 10px 16px; scrollbar-width: thin; }
    .hud-opts-list { 
        display: flex; flex-direction: column; gap: 4px; 
        min-width: 400px;
        width: fit-content; min-width: 100%; 
    }
    .hud-btn { display: flex; align-items: center; padding: 6px 10px; transition: all 0.2s; width: 100%; cursor: pointer; }
    .hud-idx { flex: 0 0 26px; text-align: center; font-weight: bold; font-size: 0.95em; margin-right: 10px; display: flex; align-items: center; justify-content: center; }
    
    /* Horizontal Alignment for Options */
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
        log('[初始化] 开始加载脚本...');
        loadSettings();
        injectStyles();
        addMenu();
        initGlobalListeners();
        registerSTEvents();
        
        setTimeout(() => {
            processChatDOM('Init');
            log('[初始化] ✅ 脚本加载完成！');
            // 显示加载成功提示
            if (typeof SillyTavern.toastr !== 'undefined') {
                toastr.success('美化终端 v30.0 已加载', '状态栏脚本');
            }
        }, 1000);
    }

    function injectStyles() {
        if (!$('#tri-hud-style').length) {
            $('head').append(`<style id="tri-hud-style">${STYLES}</style>`);
            log('[样式] CSS注入成功');
        }
    }

    // --- Event Delegation ---
    function initGlobalListeners() {
        log('[事件] 初始化全局监听器');
        const $chat = $('#chat');
        
        // 人物列表折叠
        $chat.on('click', '.hud-users-toggle', function(e) {
            e.stopPropagation(); e.preventDefault();
            const $bar = $(this);
            const $scroll = $bar.next('.hud-users-scroll');
            $scroll.toggleClass('collapsed');
            $bar.find('.fa-chevron-down').toggleClass('rotate-icon');
            log('[事件] 人物列表折叠切换');
        });

        // 选项点击
        $chat.on('click', '.hud-btn', function(e) {
            e.stopPropagation(); e.preventDefault();
            const fullText = decodeURIComponent($(this).attr('data-full-text'));
            $('#send_textarea').val(fullText).trigger('input').focus();
            if (settings.autoSend) setTimeout(() => $('#send_but').trigger('click'), 100);
            log('[事件] 选项点击:', fullText);
        });
        
        // 刷新按钮
        $chat.on('click', '.hud-refresh-btn', function(e) {
            e.stopPropagation(); e.preventDefault();
            log('[刷新] 手动刷新触发');
            const $hud = $(this).closest('.hud-root');
            const $small = $hud.prev('.hud-hide');
            
            if ($small.length) {
                // 重新处理这个small元素
                $small.removeAttr('data-hud-processed').removeClass('hud-hide');
                $hud.remove();
                processChatDOM('Manual-Refresh');
                log('[刷新] 重新渲染完成');
            }
        });
    }

    // --- DOM Processing ---
    let renderLock = false;
    function processChatDOM(src) {
        if (renderLock) {
            log(`[渲染] 渲染锁定中，跳过 (${src})`);
            return;
        }
        renderLock = true;
        setTimeout(() => renderLock = false, 200);

        log(`[渲染] 开始处理DOM (来源: ${src})`);
        let processedCount = 0;

        $('.mes_text small').each(function() {
            const $el = $(this);
            if ($el.attr('data-hud-processed')) return;
            const text = $el.text();
            if (!text.includes('状态栏') && !text.includes('人物列表') && !text.includes('行动选项')) return;

            log('[渲染] 发现待处理的状态栏元素');
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
                log('[渲染] HUD渲染成功', data);
            } else {
                log('[渲染] 解析数据失败');
            }
        });
        
        log(`[渲染] 完成，处理了 ${processedCount} 个状态栏`);
    }

    // --- Advanced Parser (Multi-line Support + JSON Extraction) ---
    function parseContent(domEl) {
        if (!domEl) return null;
        log('[解析] 开始解析内容');
        
        let html = domEl.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/div>/gi, '\n');
        const temp = document.createElement('div'); temp.innerHTML = html;
        const fullText = temp.innerText || temp.textContent;
        
        // 首先尝试提取JSON数据
        const jsonData = extractJSONFromText(fullText);
        if (jsonData) {
            characterStats = parseCharacterStatsFromJSON(jsonData);
            log('[解析] JSON数据提取并存储成功');
        } else {
            log('[解析] 未找到JSON数据或解析失败');
        }
        
        // 移除JSON部分，继续解析剩余内容
        let textWithoutJSON = fullText;
        if (jsonData) {
            textWithoutJSON = fullText.replace(/\{[\s\S]*?\}/, '').trim();
        }
        
        const lines = textWithoutJSON.split('\n').map(l => l.trim()).filter(l => l);

        let res = { status: [], users: [], options: [], tips: '' };
        let mode = 'none';
        let currentUser = null;
        let lastActiveItem = null;
        let lastActiveType = null;
        let lastUserKey = null;

        for (let line of lines) {
            if (line.includes('状态栏')) { mode = 'status'; lastActiveItem = null; log('[解析] 进入状态栏模式'); continue; }
            if (line.includes('人物列表')) { mode = 'users'; lastActiveItem = null; log('[解析] 进入人物列表模式'); continue; }
            if (line.includes('行动选项')) { mode = 'options'; lastActiveItem = null; log('[解析] 进入行动选项模式'); continue; }
            if (line.match(/^Tips[:：]/i)) { res.tips = line.replace(/^Tips[:：]\s*/i, ''); log('[解析] 提取Tips'); continue; }

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
                    log('[解析] 新用户开始');
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
        
        log('[解析] 解析完成', {
            statusCount: res.status.length,
            usersCount: res.users.length,
            optionsCount: res.options.length
        });
        
        if (!res.status.length && !res.users.length && !res.options.length) {
            log('[解析] 无有效内容');
            return null;
        }
        return res;
    }

    function splitFirst(str, regex) {
        const match = str.match(regex);
        if (!match) return null;
        return [str.substring(0, match.index).trim(), str.substring(match.index + match[0].length).trim()];
    }

    // --- 生成数值条HTML (增强版) ---
    function renderStatBars(characterName) {
        log(`[渲染数值条] 开始为 ${characterName} 渲染数值条`);
        
        if (!characterStats[characterName]) {
            log(`[渲染数值条] ${characterName} 无数据`);
            return '';
        }
        
        const stats = characterStats[characterName];
        const statKeys = Object.keys(stats);
        
        if (statKeys.length === 0) {
            log(`[渲染数值条] ${characterName} 属性为空`);
            return '';
        }
        
        let html = `<div class="hud-stat-bar-wrapper">`;
        
        statKeys.forEach(key => {
            const stat = stats[key];
            const safeValue = Math.max(0, Math.min(stat.max, stat.value || 0));
            const percentage = (safeValue / stat.max) * 100;
            
            // 简化标签显示
            let displayLabel = key;
            if (stat.description) {
                // 尝试从描述中提取简短标签
                const labelMatch = stat.description.match(/^(.+?)值/);
                if (labelMatch) {
                    displayLabel = labelMatch[1];
                }
            }
            
            html += `
                <div class="hud-stat-bar">
                    <div class="hud-stat-bar-label">
                        <span class="hud-stat-bar-label-text" title="${stat.description}">${displayLabel}</span>
                        <span class="hud-stat-bar-label-value">${safeValue}/${stat.max}</span>
                    </div>
                    <div class="hud-stat-bar-container">
                        <div class="hud-stat-bar-fill" style="width: ${percentage}%">
                            <div class="hud-stat-bar-text">${percentage.toFixed(0)}%</div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        log(`[渲染数值条] ${characterName} 渲染完成，共 ${statKeys.length} 个属性`);
        return html;
    }

    // --- Rendering ---
    function renderHUD(data) {
        log('[渲染HUD] 开始生成HTML');
        let html = `<div class="hud-root">`;
        
        // 刷新按钮（固定在右上角）
        html += `<div class="hud-refresh-btn" title="刷新数据"><i class="fa-solid fa-rotate-right"></i></div>`;

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
            log('[渲染HUD] 状态栏渲染完成');
        }

        // 2. Users (修改：动态添加角色统计条)
        if (data.users.length) {
            html += `<div class="hud-users-toggle"><span><i class="fa-solid fa-users"></i> 人物列表 (${data.users.length})</span><i class="fa-solid fa-chevron-down"></i></div>`;
            html += `<div class="hud-users-scroll collapsed">`;
            data.users.forEach(u => {
                let name = u['名字'] || u['Name'] || 'Unknown';
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
                
                // 动态添加数值条
                let statBars = renderStatBars(name);
                
                html += `<div class="hud-user-card"><div class="hud-user-name">${name}</div>${props}${statBars}</div>`;
            });
            html += `</div>`;
            log('[渲染HUD] 人物列表渲染完成');
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
            log('[渲染HUD] 选项列表渲染完成');
        }

        if (data.tips) {
            html += `<div class="hud-tips"><i class="fa-solid fa-lightbulb"></i> ${data.tips}</div>`;
            log('[渲染HUD] Tips渲染完成');
        }

        html += `</div>`;
        log('[渲染HUD] HTML生成完成');
        return $(html);
    }

    // --- Settings & Menu ---
    function applySettingsToElement($el) {
        $el.removeClass('hud-theme-luxury hud-theme-floral hud-theme-candy');
        $el.addClass(`hud-theme-${settings.theme}`);
        $el.css('--hud-scale', settings.scale);
        $el.css('font-family', settings.fontFamily || '');
        log('[样式] 应用主题:', settings.theme);
    }

    function addMenu() {
        const extensionsMenu = $('#extensionsMenu');
        const menuItemId = `${SCRIPT_ID}-menu`;
        if (extensionsMenu.length === 0) { 
            setTimeout(addMenu, 1000); 
            return; 
        }
        if ($(`#${menuItemId}`).length > 0) return;

        const btn = $(`<div class="list-group-item flex-container flexGap5 interactable" id="${menuItemId}"><div class="fa-fw fa-solid fa-palette"></div><span>美化终端设置</span></div>`);
        btn.on('click', () => {
            log('[菜单] 打开设置面板');
            const html = `
            <div style="padding:15px; display:flex; flex-direction:column; gap:15px;">
                <h3>终端样式设置 (Std API v30)</h3>
                <div><label>主题风格:</label><select id="hud-theme-select" class="text_pole" style="width:100%;margin-top:5px;"><option value="luxury" ${settings.theme==='luxury'?'selected':''}>商务奢华 (Dark Gold)</option><option value="floral" ${settings.theme==='floral'?'selected':''}>清新花艺 (Nature)</option><option value="candy" ${settings.theme==='candy'?'selected':''}>糖果波普 (Vibrant)</option></select></div>
                <div><label>字体缩放 (${settings.scale}):</label><input type="range" id="hud-scale-range" min="0.8" max="1.3" step="0.05" value="${settings.scale}" style="width:100%"></div>
                <div><label>自定义字体:</label><input type="text" id="hud-font-input" class="text_pole" placeholder="留空默认" value="${settings.fontFamily}" style="width:100%"></div>
                <label class="checkbox_label"><input type="checkbox" id="hud-auto-send" ${settings.autoSend?'checked':''}> 点击选项自动发送</label>
                <label class="checkbox_label"><input type="checkbox" id="hud-debug" ${settings.debug?'checked':''}> 开启Debug日志</label>
                <button id="hud-force-refresh" class="menu_button">🔄 强制重绘 (Fix Layout)</button>
            </div>`;
            SillyTavern.callGenericPopup(html, 1, '', {wide:false});
            setTimeout(() => {
                $('#hud-theme-select').on('change', function() { settings.theme = this.value; saveSettings(); });
                $('#hud-scale-range').on('input', function() { settings.scale = parseFloat(this.value); $(this).prev().text(`字体缩放 (${settings.scale}):`); saveSettings(); });
                $('#hud-font-input').on('change', function() { settings.fontFamily = this.value; saveSettings(); });
                $('#hud-auto-send').on('change', function() { settings.autoSend = this.checked; saveSettings(); });
                $('#hud-debug').on('change', function() { settings.debug = this.checked; saveSettings(); });
                $('#hud-force-refresh').on('click', function() {
                    log('[菜单] 强制刷新触发');
                    $('.mes_text small').removeAttr('data-hud-processed').removeClass('hud-hide');
                    $('.hud-root').remove();
                    characterStats = {};
                    processChatDOM('Manual-Force');
                });
            }, 100);
        });
        extensionsMenu.append(btn);
        log('[菜单] 添加成功');
    }

    // --- Standard Event Hooks ---
    function registerSTEvents() {
        log('[事件] 注册SillyTavern事件钩子');
        if (!SillyTavern.eventSource) return;
        const updateEvents = [
            SillyTavern.eventTypes?.MESSAGE_UPDATED || 'message_updated',
            SillyTavern.eventTypes?.MESSAGE_SWIPED || 'message_swiped',
            SillyTavern.eventTypes?.CHAT_CHANGED || 'chat_changed',
            SillyTavern.eventTypes?.GENERATION_ENDED || 'generation_ended',
            SillyTavern.eventTypes?.MESSAGE_RECEIVED || 'message_received'
        ];
        updateEvents.forEach(evt => {
            if (evt) SillyTavern.eventSource.on(evt, () => setTimeout(() => {
                log(`[事件] ${evt} 触发`);
                processChatDOM(evt);
            }, 200));
        });
        
        const chatContainer = document.querySelector('#chat');
        if (chatContainer) {
            const obs = new MutationObserver((mutations) => {
                if (mutations.some(m => m.addedNodes.length)) {
                    processChatDOM('Mutation');
                }
            });
            obs.observe(chatContainer, { childList: true, subtree: true });
            log('[事件] MutationObserver注册成功');
        }
    }
})();
