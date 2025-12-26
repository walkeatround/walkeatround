// ==UserScript==
// @name         生图助手 (v43.0 - 世界书集成)
// @version      v43.0
// @description  新增世界书集成功能：选择角色世界书条目注入独立API生词，优化提示词结构避免AI在参考资料处生图
// @author       Walkeatround & Gemini & AI Assistant
// @match        */*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    function gmFetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method || 'GET',
                url: url,
                headers: options.headers || {},
                data: options.body || undefined,
                timeout: 60000,  // 60秒超时
                onload: (response) => {
                    const res = {
                        ok: response.status >= 200 && response.status < 300,
                        status: response.status,
                        statusText: response.statusText,
                        headers: {
                            get: (name) => {
                                const header = response.responseHeaders
                                    .split('\n')
                                    .find(h => h.toLowerCase().startsWith(name.toLowerCase()));
                                return header ? header.split(': ')[1] : null;
                            }
                        },
                        text: () => Promise.resolve(response.responseText),
                        json: () => {
                            try {
                                return Promise.resolve(JSON.parse(response.responseText));
                            } catch (e) {
                                return Promise.reject(new Error('Invalid JSON: ' + response.responseText.substring(0, 100)));
                            }
                        }
                    };
                    resolve(res);
                },
                onerror: (error) => {
                    reject(new Error(`Network error: ${error.error || 'Unknown'}`));
                },
                ontimeout: () => {
                    reject(new Error('Request timeout (60s)'));
                }
            });
        });
    }

    // 智能选择：有 GM 就用 GM，没有就用普通 fetch
    const safeFetch = (typeof GM_xmlhttpRequest !== 'undefined') ? gmFetch : fetch;

    const SCRIPT_ID = 'sd_gen_standard_v35';
    const STORAGE_KEY = 'sd_gen_settings';
    const TEMPLATES_KEY = 'sd_gen_templates';
    const NO_GEN_FLAG = '[no_gen]';
    const SCHEDULED_FLAG = '[scheduled]';
    
    const RUNTIME_LOGS = [];
    function addLog(type, msg) {
        const logLine = `[${new Date().toLocaleTimeString()}] [${type}] ${msg}`;
        RUNTIME_LOGS.push(logLine);
        console.log(logLine);
    }

    // --- 精简后的默认提示词模版 (只保留默认模版) ---
    const DEFAULT_TEMPLATES = {
        "默认模版": `<IMAGE_PROMPT_TEMPLATE>
You are a Visual Novel Engine. Generate story with image prompts wrapped in [IMG_GEN]...[/IMG_GEN] tags.

## 人物数据库（固定特征标签 - 必须原样复制，视为不可修改代码）
<!--人物列表-->

### 人物标签使用规则
- 严格根据剧情内容决定画哪个人物，使用对应人物的固定特征标签
- 只画剧情中实际出场的人物，不要画未出现的人物
- 提示词插入位置必须紧跟人物出场的文本段落之后，不可提前
- 人物A在前半段出场就在前半段生成，人物B在后半段出场就在后半段生成

## 核心规则
1. 每200-250字或场景/表情/动作变化时插入一个图片提示词
2. 每个提示词只描述一个角色（禁止2girls、1boy1girl等多人标签）
3. 人物数据库中的固定特征标签必须原样复制，不可修改
4. 多人互动场景：分别从每个角色的视角生成单独的提示词
5. 禁止生成URL或文件路径（如/user/images/xxx.png）

## 标签格式
\`1girl/1boy, [固定特征], [表情], [服装], [姿势/动作], [视角], [环境], [光照], [质量词]\`

## 姿势与动作
- 站立: standing, leaning against wall, arms crossed, hands on hips
- 坐姿: sitting, sitting on chair, sitting on bed, crossed legs, kneeling
- 躺卧: lying down, lying on back, lying on side, lying on stomach
- 动态: walking, running, jumping, reaching out, turning around
- 互动: looking at viewer, looking away, looking back, looking up, looking down
- 手部: hands together, hand on chest, hand on face, raised hand
- 特殊: crouching, bending over, stretching, hugging, embracing

## 视角与构图
- 视角: from above, from below, from side, from behind, dutch angle, pov
- 距离: close-up, upper body, cowboy shot, full body, wide shot
- 焦点: face focus, eye focus, depth of field, blurry background

## 环境背景
- 室内: bedroom, living room, classroom, office, bathroom, kitchen
- 室外: street, park, garden, beach, forest, rooftop, balcony
- 光照: sunlight, moonlight, indoor lighting, dramatic lighting, soft lighting

## 服装描述
- 上身: shirt, blouse, sweater, jacket, dress, tank top, topless
- 下身: skirt, pants, shorts, jeans, bottomless
- 足部: shoes, boots, sandals, barefoot, high heels
- 状态: wet clothes, torn clothes, disheveled clothes, naked

## 表情
smile, sad, angry, surprised, scared, blushing, gentle smile, tearful eyes, embarrassed

## 质量词后缀
highly detailed, masterpiece, best quality
</IMAGE_PROMPT_TEMPLATE>`
            };

    const DEFAULT_SETTINGS = {
        enabled: true, 
        startTag: '[IMG_GEN]', 
        endTag: '[/IMG_GEN]',
        globalPrefix: 'best quality, masterpiece', 
        globalSuffix: '',
        globalNegative: 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry',
        injectEnabled: true, 
        injectDepth: 0, 
        injectRole: 'system',
        selectedTemplate: "默认模版",
        characters: [
            { name: 'Character 1', tags: 'long white hair, red eyes, white dress', enabled: false }
        ],
        llmConfig: { 
            baseUrl: 'https://api.deepseek.com', 
            apiKey: '', 
            model: 'deepseek-chat', 
            maxTokens: 8192, 
            temperature: 0.9,
            topP: 1.0,
            presencePenalty: 0.0,
            frequencyPenalty: 0.0
        },
        autoRefresh: false,  // 自动刷新开关
        autoRefreshInterval: 3000, // 刷新间隔（毫秒）
        // 超时设置
        timeoutEnabled: false,        // 请求超时开关
        timeoutSeconds: 120,         // 超时时间（秒）
        // 独立生图模式
        independentApiEnabled: false,      // 独立生图模式开关
        independentApiHistoryCount: 4,     // 历史消息数量
        independentApiDebounceMs: 1000,    // 防抖延迟（毫秒）
        independentApiCustomPrompt: '',    // 自定义系统提示词（空=使用默认）
        independentApiFilterTags: '',      // 过滤标签（逗号分隔，如: <small>, [statbar]）
        // 世界书集成配置
        worldbookEnabled: true,            // 是否启用世界书注入
        worldbookSelections: {}            // 按角色存储的世界书条目选择 { 'characterName': { 'bookName': ['entryUid1', 'entryUid2'] } }
    };

    let settings = DEFAULT_SETTINGS;
    let customTemplates = {};
    let debounceTimer = null;
    let autoRefreshTimer = null;  // ✅ 定时器变量
    let autoRefreshPaused = false;  // ✅ 新增：记录是否因生成而暂停
    
    // 独立API模式变量
    let independentApiDebounceTimer = null;
    let independentApiAbortController = null;
    let independentApiLastPreview = { latest: '', history: [] };  // 用于UI预览
    
    // Scheduled 超时计时器 Map (key: "mesId-blockIdx", value: timeoutId)
    const scheduledTimeoutMap = new Map();

    // --- CSS ---
    const GLOBAL_CSS = `
    /* 新拟态基础变量 */
    :root {
        --nm-bg: #1e1e24;
        --nm-shadow-dark: rgba(0, 0, 0, 0.5);
        --nm-shadow-light: rgba(60, 60, 70, 0.3);
        --nm-accent: #6c8cff;
        --nm-accent-glow: rgba(108, 140, 255, 0.3);
        --nm-text: #d4d4dc;
        --nm-text-muted: #8888a0;
        --nm-border: rgba(255, 255, 255, 0.05);
        --nm-radius: 12px;
        --nm-radius-sm: 8px;
    }
    
    .sd-ui-container * { box-sizing: border-box; user-select: none; font-family: 'Georgia', 'Times New Roman', 'Noto Serif SC', serif; }
    .sd-ui-wrap { display: flex; flex-direction: column; background: transparent; border: none; margin: 5px 0; width: 100%; position: relative; transition: all 0.3s ease; }
    .sd-ui-toggle { text-align: center; cursor: pointer; font-size: 0.8em; opacity: 0.2; color: var(--nm-text); margin-bottom: 2px; transition: opacity 0.2s; line-height: 1; }
    .sd-ui-toggle:hover { opacity: 1; color: var(--nm-accent); }
    .sd-ui-viewport { position: relative; width: 100%; min-height: 50px; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; overflow: hidden; }
    .sd-ui-viewport.collapsed { display: none; }
    .sd-ui-image { max-width: 100%; max-height: 600px; width: auto; height: auto; border-radius: var(--nm-radius); box-shadow: 4px 4px 12px var(--nm-shadow-dark), -2px -2px 8px var(--nm-shadow-light); transition: opacity 0.2s; z-index: 1; }
    .sd-zone { position: absolute; background: transparent; }
    .sd-zone.delete { bottom: 0; left: 0; width: 40%; height: 5%; z-index: 100; cursor: no-drop; }
    .sd-zone.left { top: 0; left: 0; width: 20%; height: 90%; z-index: 90; cursor: w-resize; }
    .sd-zone.right { top: 0; right: 0; width: 20%; height: 90%; z-index: 90; cursor: e-resize; }
    .sd-zone.right.gen-mode { cursor: alias; }
    .sd-zone.top { top: 0; left: 0; width: 100%; height: 20%; z-index: 80; cursor: text; }
    .sd-ui-msg { position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); background: var(--nm-bg); color: var(--nm-text); padding: 6px 12px; border-radius: var(--nm-radius-sm); font-size: 11px; pointer-events: none; opacity: 0; transition: opacity 0.3s; z-index: 15; white-space: nowrap; box-shadow: 3px 3px 8px var(--nm-shadow-dark), -2px -2px 6px var(--nm-shadow-light); }
    .sd-ui-msg.show { opacity: 1; }
    .sd-placeholder { padding: 20px; background: var(--nm-bg); border-radius: var(--nm-radius); color: var(--nm-text-muted); font-size: 0.9em; text-align: center; width: 100%; box-shadow: inset 3px 3px 6px var(--nm-shadow-dark), inset -2px -2px 5px var(--nm-shadow-light); }
    
    /* 新拟态Tab导航 */
    .sd-tab-nav { display: flex; gap: 8px; margin-bottom: 20px; padding: 8px; background: var(--nm-bg); border-radius: var(--nm-radius); box-shadow: inset 3px 3px 8px var(--nm-shadow-dark), inset -2px -2px 6px var(--nm-shadow-light); }
    .sd-tab-btn { padding: 10px 16px; cursor: pointer; opacity: 0.7; border-radius: var(--nm-radius-sm); font-weight: 600; transition: all 0.25s ease; color: var(--nm-text-muted); background: transparent; font-family: 'Georgia', 'Times New Roman', 'Noto Serif SC', serif; letter-spacing: 0.5px; }
    .sd-tab-btn:hover { opacity: 1; background: rgba(255,255,255,0.03); color: var(--nm-text); }
    .sd-tab-btn.active { opacity: 1; color: var(--nm-accent); background: linear-gradient(145deg, #252530, #1a1a20); box-shadow: 4px 4px 8px var(--nm-shadow-dark), -2px -2px 6px var(--nm-shadow-light), 0 0 10px var(--nm-accent-glow); }
    .sd-tab-content { display: none; animation: sd-fade 0.3s ease; }
    .sd-tab-content.active { display: block; }
    @keyframes sd-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    
    /* 新拟态人物列表 */
    .sd-char-row { display: flex; gap: 8px; margin-bottom: 10px; align-items: center; padding: 10px; background: linear-gradient(145deg, #252530, #1e1e24); border-radius: var(--nm-radius-sm); box-shadow: 3px 3px 6px var(--nm-shadow-dark), -2px -2px 5px var(--nm-shadow-light); }
    .sd-char-checkbox { flex: 0 0 20px; accent-color: var(--nm-accent); }
    .sd-char-name { flex: 0 0 20%; min-width: 80px; }
    .sd-char-tags { flex: 1; font-family: 'Consolas', 'Monaco', monospace; font-size: 0.9em; min-width: 200px; }
    .sd-char-del { flex: 0 0 50px; background: linear-gradient(145deg, #3a2530, #301a20); color: #ff8888; border: none; cursor: pointer; height: 36px; border-radius: var(--nm-radius-sm); font-size: 0.85em; transition: all 0.25s; box-shadow: 2px 2px 5px var(--nm-shadow-dark), -1px -1px 3px var(--nm-shadow-light); font-family: 'Georgia', 'Times New Roman', serif; }
    .sd-char-del:hover { background: linear-gradient(145deg, #4a2535, #351a22); box-shadow: 3px 3px 8px var(--nm-shadow-dark), -2px -2px 6px var(--nm-shadow-light); color: #ffaaaa; }
    .sd-add-btn { width: 100%; padding: 12px; background: var(--nm-bg); border: none; color: var(--nm-text-muted); cursor: pointer; border-radius: var(--nm-radius-sm); transition: all 0.25s; box-shadow: inset 2px 2px 5px var(--nm-shadow-dark), inset -1px -1px 4px var(--nm-shadow-light); font-family: 'Georgia', 'Times New Roman', serif; font-size: 0.95em; }
    .sd-add-btn:hover { color: var(--nm-accent); box-shadow: inset 3px 3px 8px var(--nm-shadow-dark), inset -2px -2px 6px var(--nm-shadow-light); }
    .sd-char-list-container { max-height: 300px; overflow-y: auto; margin-bottom: 15px; padding: 12px; background: var(--nm-bg); border-radius: var(--nm-radius); box-shadow: inset 4px 4px 10px var(--nm-shadow-dark), inset -3px -3px 8px var(--nm-shadow-light); }
    
    /* 新拟态模版区域 */
    .sd-template-section { margin-top: 15px; padding: 15px; background: linear-gradient(145deg, #252530, #1e1e24); border-radius: var(--nm-radius); box-shadow: 5px 5px 12px var(--nm-shadow-dark), -3px -3px 8px var(--nm-shadow-light); }
    .sd-template-section label { display: block; margin-bottom: 8px; font-weight: 600; color: var(--nm-text); font-family: 'Georgia', 'Times New Roman', serif; letter-spacing: 0.5px; }
    .sd-template-controls { display: flex; gap: 8px; margin-top: 12px; }
    .sd-template-controls button { flex: 1; padding: 8px; font-size: 0.85em; }
    .sd-template-editor { display: none; margin-top: 15px; padding: 18px; background: var(--nm-bg); border-radius: var(--nm-radius); border-left: 3px solid var(--nm-accent); animation: sd-fade 0.3s; box-shadow: inset 3px 3px 8px var(--nm-shadow-dark), inset -2px -2px 6px var(--nm-shadow-light); }
    .sd-template-editor.show { display: block; }
    .sd-template-title-row { display: flex; gap: 10px; margin-bottom: 12px; align-items: center; }
    .sd-template-title-row input { flex: 1; }
    .sd-template-title-row button { flex: 0 0 80px; }
    
    /* 新拟态API配置行 */
    .sd-api-row { display: flex; gap: 12px; margin-bottom: 12px; align-items: center; padding: 8px 12px; background: linear-gradient(145deg, #252530, #1e1e24); border-radius: var(--nm-radius-sm); box-shadow: 2px 2px 5px var(--nm-shadow-dark), -1px -1px 4px var(--nm-shadow-light); }
    .sd-api-row label { flex: 0 0 100px; font-weight: 600; color: var(--nm-text-muted); font-family: 'Georgia', 'Times New Roman', serif; font-size: 0.9em; }
    .sd-api-row input, .sd-api-row select { flex: 1; background: var(--nm-bg) !important; border: none !important; color: var(--nm-text) !important; padding: 10px 12px !important; border-radius: var(--nm-radius-sm) !important; box-shadow: inset 2px 2px 5px var(--nm-shadow-dark), inset -1px -1px 4px var(--nm-shadow-light) !important; font-family: 'Georgia', 'Times New Roman', serif !important; }
    .sd-api-row input:focus, .sd-api-row select:focus { outline: none; box-shadow: inset 2px 2px 5px var(--nm-shadow-dark), inset -1px -1px 4px var(--nm-shadow-light), 0 0 8px var(--nm-accent-glow) !important; }
    .sd-api-row .sd-range-value { flex: 0 0 50px; text-align: center; font-family: 'Consolas', 'Monaco', monospace; color: var(--nm-accent); font-weight: 600; }
    .sd-inject-row { display: flex; gap: 10px; margin-bottom: 10px; align-items: center; }
    .sd-inject-row label { flex: 0 0 100px; font-weight: 600; color: var(--nm-text-muted); font-family: 'Georgia', 'Times New Roman', serif; }
    .sd-inject-row input, .sd-inject-row select { flex: 1; }
    
    /* 新拟态按钮 */
    .sd-btn-primary { background: linear-gradient(145deg, var(--nm-accent), #5a78dd); color: #fff; border: none; padding: 10px 20px; border-radius: var(--nm-radius-sm); cursor: pointer; transition: all 0.25s; font-family: 'Georgia', 'Times New Roman', serif; font-weight: 600; letter-spacing: 0.5px; box-shadow: 3px 3px 8px var(--nm-shadow-dark), -2px -2px 6px var(--nm-shadow-light), 0 0 12px var(--nm-accent-glow); }
    .sd-btn-primary:hover { transform: translateY(-1px); box-shadow: 4px 4px 12px var(--nm-shadow-dark), -3px -3px 8px var(--nm-shadow-light), 0 0 20px var(--nm-accent-glow); }
    .sd-btn-primary:active { transform: translateY(0); box-shadow: inset 2px 2px 5px rgba(0,0,0,0.3), 0 0 8px var(--nm-accent-glow); }
    .sd-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .sd-btn-secondary { background: linear-gradient(145deg, #2a2a35, #22222a); color: var(--nm-text); border: none; padding: 10px 20px; border-radius: var(--nm-radius-sm); cursor: pointer; transition: all 0.25s; font-family: 'Georgia', 'Times New Roman', serif; font-weight: 500; box-shadow: 3px 3px 8px var(--nm-shadow-dark), -2px -2px 6px var(--nm-shadow-light); }
    .sd-btn-secondary:hover { background: linear-gradient(145deg, #32323f, #28282f); box-shadow: 4px 4px 10px var(--nm-shadow-dark), -3px -3px 8px var(--nm-shadow-light); color: var(--nm-accent); }
    .sd-btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
    .sd-btn-danger { background: linear-gradient(145deg, #4a2530, #3a1a22); color: #ff9999; border: none; padding: 10px 20px; border-radius: var(--nm-radius-sm); cursor: pointer; transition: all 0.25s; font-family: 'Georgia', 'Times New Roman', serif; font-weight: 500; box-shadow: 3px 3px 8px var(--nm-shadow-dark), -2px -2px 6px var(--nm-shadow-light); }
    .sd-btn-danger:hover { background: linear-gradient(145deg, #5a2a38, #451f28); color: #ffbbbb; box-shadow: 4px 4px 10px var(--nm-shadow-dark), -3px -3px 8px var(--nm-shadow-light); }
    
    .sd-ai-update-box { margin-bottom: 12px; padding: 15px; background: var(--nm-bg); border-radius: var(--nm-radius); display: none; border-left: 3px solid var(--nm-accent); box-shadow: inset 2px 2px 5px var(--nm-shadow-dark), inset -1px -1px 4px var(--nm-shadow-light); }
    .sd-ai-update-box.show { display: block; animation: sd-fade 0.2s; }
    .sd-config-controls { display: flex; gap: 10px; margin-top: 15px; }
    .sd-config-controls button { flex: 1; }
    
    /* 请求中状态的脉冲动画 */
    .sd-placeholder.requesting { color: var(--nm-accent) !important; animation: sd-pulse 1.5s ease-in-out infinite; }
    @keyframes sd-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
    
    /* 新拟态输入框样式 - 仅限弹窗内 */
    .sd-settings-popup .text_pole { background: var(--nm-bg) !important; border: none !important; color: var(--nm-text) !important; padding: 10px 12px !important; border-radius: var(--nm-radius-sm) !important; box-shadow: inset 2px 2px 5px var(--nm-shadow-dark), inset -1px -1px 4px var(--nm-shadow-light) !important; font-family: 'Georgia', 'Times New Roman', 'Noto Serif SC', serif !important; transition: all 0.2s !important; }
    .sd-settings-popup .text_pole:focus { outline: none !important; box-shadow: inset 2px 2px 5px var(--nm-shadow-dark), inset -1px -1px 4px var(--nm-shadow-light), 0 0 10px var(--nm-accent-glow) !important; }
    
    /* 新拟态滚动条 */
    .sd-char-list-container::-webkit-scrollbar, .sd-indep-preview::-webkit-scrollbar { width: 8px; }
    .sd-char-list-container::-webkit-scrollbar-track, .sd-indep-preview::-webkit-scrollbar-track { background: var(--nm-bg); border-radius: 4px; }
    .sd-char-list-container::-webkit-scrollbar-thumb, .sd-indep-preview::-webkit-scrollbar-thumb { background: linear-gradient(145deg, #3a3a45, #2a2a35); border-radius: 4px; box-shadow: 1px 1px 3px var(--nm-shadow-dark); }
    
    /* 新拟态标题样式 - 仅限弹窗内 */
    .sd-settings-popup h4 { font-family: 'Georgia', 'Times New Roman', 'Noto Serif SC', serif !important; color: var(--nm-text) !important; letter-spacing: 0.5px; font-weight: 600; }
    .sd-settings-popup small { color: var(--nm-text-muted) !important; font-family: 'Georgia', 'Times New Roman', 'Noto Serif SC', serif !important; }
    .sd-settings-popup label { font-family: 'Georgia', 'Times New Roman', 'Noto Serif SC', serif !important; }
    `;

    // --- UTILITIES ---
    function closePopup() {
        const okButton = $('#dialogue_popup_ok, .popup-button-ok, .menu_button:contains("OK"), button:contains("OK")').filter(':visible').first();
        if (okButton.length > 0) {
            okButton.click();
            return true;
        }
        
        if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.closePopup === 'function') {
            SillyTavern.closePopup();
            return true;
        }
        
        const popup = $('#dialogue_popup, .popup, [role="dialog"]').filter(':visible').first();
        if (popup.length > 0) {
            popup.hide();
            return true;
        }
        
        return false;
    }

    // 导出配置
    function exportConfig() {
        const currentCharName = getCurrentCharacterName();
        const config = {
            version: '43.0',  // 更新版本：世界书集成
            exportDate: new Date().toISOString(),
            exportedFromCharacter: currentCharName || '未知角色',  // 记录导出时的角色
            settings: settings,
            customTemplates: customTemplates
        };
        
        const dataStr = JSON.stringify(config, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `sd-gen-config-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toastr.success('✅ 配置已导出');
        addLog('CONFIG', '配置导出成功');
    }

    // 导入配置
    function importConfig() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const config = JSON.parse(text);
                
                // 验证配置格式
                if (!config.settings || !config.customTemplates) {
                    throw new Error('配置文件格式不正确');
                }
                
                // 确认导入
                if (!confirm(`确定要导入配置吗？\n\n导出日期: ${config.exportDate || '未知'}\n版本: ${config.version || '未知'}\n\n当前配置将被覆盖！`)) {
                    return;
                }
                
                // 应用配置
                settings = { ...DEFAULT_SETTINGS, ...config.settings };
                settings.llmConfig = { ...DEFAULT_SETTINGS.llmConfig, ...config.settings.llmConfig };
                customTemplates = config.customTemplates || {};
                
                // 保存到localStorage
                saveSettings();
                saveTemplates();
                
                toastr.success('✅ 配置已导入');
                addLog('CONFIG', '配置导入成功');
                
                // 刷新界面
                closePopup();
                setTimeout(() => openSettingsPopup(), 200);
                
            } catch (error) {
                toastr.error(`❌ 导入失败: ${error.message}`);
                addLog('ERROR', `配置导入失败: ${error.message}`);
            }
        };
        
        input.click();
    }

    async function fetchModels(baseUrl, apiKey) {
        try {
            const url = baseUrl.replace(/\/$/, '') + '/models';
            const headers = { 'Content-Type': 'application/json' };
            if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
            
            const res = await safeFetch(url, { method: 'GET', headers });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            
            const data = await res.json();
            const models = data.data || data;
            
            if (Array.isArray(models)) {
                return models.map(m => typeof m === 'string' ? m : (m.id || m.name || m.model));
            }
            return [];
        } catch (e) { 
            addLog('ERROR', `获取模型失败: ${e.message}`);
            throw new Error(e.message || '连接失败'); 
        }
    }

    async function callLLMForUpdate(prompt, instruction) {
        const config = settings.llmConfig;
        if (!config.baseUrl || !config.apiKey) {
            throw new Error("请先配置 API URL 和 API Key");
        }
        
        const url = config.baseUrl.replace(/\/$/, '') + '/chat/completions';
        
        const systemContent = "You are a Stable Diffusion Prompt Assistant. Output ONLY the modified comma-separated tags without explanations.";
        const userContent = `Current Prompt: ${prompt}\n\nInstruction: ${instruction}\n\nModified Prompt:`;

        const requestBody = {
            model: config.model || 'deepseek-chat',
            messages: [
                { role: "system", content: systemContent },
                { role: "user", content: userContent }
            ],
            temperature: parseFloat(config.temperature) || 0.7,
            max_tokens: parseInt(config.maxTokens) || 500,
            top_p: parseFloat(config.topP) || 1.0,
            frequency_penalty: parseFloat(config.frequencyPenalty) || 0.0,
            presence_penalty: parseFloat(config.presencePenalty) || 0.0,
            stream: false
        };

        addLog('API', `请求: ${url}`);
        addLog('API', `Model: ${requestBody.model}`);

        try {
            const res = await safeFetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${config.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!res.ok) {
                const errorText = await res.text();
                addLog('ERROR', `API响应: ${res.status} - ${errorText}`);
                throw new Error(`API Error ${res.status}: ${errorText}`);
            }

            const data = await res.json();
            addLog('API', `响应成功`);
            
            // 兼容推理模型（如deepseek-reasoner）和普通模型
            const message = data.choices?.[0]?.message;
            const content = message?.content?.trim() || message?.reasoning_content?.trim();
            if (!content) {
                throw new Error("API返回内容为空");
            }
            
            return content;
        } catch (error) {
            addLog('ERROR', `API调用失败: ${error.message}`);
            throw error;
        }
    }

    async function callLLMForTemplateUpdate(currentTemplate, instruction) {
        const config = settings.llmConfig;
        if (!config.baseUrl || !config.apiKey) {
            throw new Error("请先配置 API URL 和 API Key");
        }
        
        const url = config.baseUrl.replace(/\/$/, '') + '/chat/completions';
        
        const systemContent = "You are an AI Prompt Template Assistant. Modify the provided template according to user instructions. Output ONLY the modified template without explanations. Keep the <!--人物列表--> placeholder intact.";
        const userContent = `Current Template:\n${currentTemplate}\n\nModification Request:\n${instruction}\n\nModified Template:`;

        const requestBody = {
            model: config.model || 'deepseek-chat',
            messages: [
                { role: "system", content: systemContent },
                { role: "user", content: userContent }
            ],
            temperature: parseFloat(config.temperature) || 0.7,
            max_tokens: parseInt(config.maxTokens) || 2000,
            top_p: parseFloat(config.topP) || 1.0,
            frequency_penalty: parseFloat(config.frequencyPenalty) || 0.0,
            presence_penalty: parseFloat(config.presencePenalty) || 0.0,
            stream: false
        };

        addLog('API', `模版修改请求: ${url}`);

        try {
            const res = await safeFetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${config.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!res.ok) {
                const errorText = await res.text();
                addLog('ERROR', `API响应: ${res.status} - ${errorText}`);
                throw new Error(`API Error ${res.status}: ${errorText}`);
            }

            const data = await res.json();
            addLog('API', `模版修改成功`);
            
            // 兼容推理模型（如deepseek-reasoner）和普通模型
            const message = data.choices?.[0]?.message;
            const content = message?.content?.trim() || message?.reasoning_content?.trim();
            if (!content) {
                throw new Error("API返回内容为空");
            }
            
            return content;
        } catch (error) {
            addLog('ERROR', `模版AI修改失败: ${error.message}`);
            throw error;
        }
    }

    async function safeUpdateChat(messageIndex, newContent) {
        if (typeof SillyTavern.setChatMessages === 'function') {
            try {
                await SillyTavern.setChatMessages([{ message_id: messageIndex, message: newContent }], { refresh: 'affected' });
                return;
            } catch(e) { console.warn('[SD] setChatMessages fallback.'); }
        }
        if (SillyTavern.chat && SillyTavern.chat[messageIndex]) {
            SillyTavern.chat[messageIndex].mes = newContent;
            await SillyTavern.saveChat();
        }
    }

    // ==================== 独立API生图模式核心函数 ====================
    
    // ==================== 世界书集成 ====================
    
    /**
     * 获取当前角色名称
     * @returns {string|null}
     */
    function getCurrentCharacterName() {
        try {
            // 方法1：从 characters 数组获取
            if (SillyTavern.characters && typeof SillyTavern.this_chid !== 'undefined') {
                const character = SillyTavern.characters[SillyTavern.this_chid];
                if (character?.name) {
                    return character.name;
                }
            }
            
            // 方法2：从 name2 获取（角色名称）
            if (SillyTavern.name2) {
                return SillyTavern.name2;
            }
            
            // 方法3：从 chat 历史中获取最后一条 AI 消息的名称
            if (SillyTavern.chat && SillyTavern.chat.length > 0) {
                for (let i = SillyTavern.chat.length - 1; i >= 0; i--) {
                    const msg = SillyTavern.chat[i];
                    if (!msg.is_user && msg.name) {
                        return msg.name;
                    }
                }
            }
            
            addLog('WARN', '无法获取角色名称，已尝试所有方法');
            return null;
        } catch (e) {
            addLog('WARN', `获取角色名称失败: ${e.message}`);
            return null;
        }
    }
    
    /**
     * 获取角色链接的世界书列表
     * @returns {Promise<{primary: string|null, additional: string[]}>}
     */
    async function getCharacterWorldbooks() {
        try {
            const TavernHelper = typeof window.TavernHelper !== 'undefined' 
                ? window.TavernHelper 
                : (typeof window.parent !== 'undefined' ? window.parent.TavernHelper : null);
            
            if (!TavernHelper?.getCharLorebooks) {
                addLog('WARN', 'TavernHelper.getCharLorebooks 不可用');
                return { primary: null, additional: [] };
            }
            
            const lorebooks = await TavernHelper.getCharLorebooks({ type: 'all' });
            addLog('WORLDBOOK', `获取到角色世界书: primary=${lorebooks.primary}, additional=${lorebooks.additional?.length || 0}个`);
            return lorebooks;
        } catch (e) {
            addLog('ERROR', `获取角色世界书失败: ${e.message}`);
            return { primary: null, additional: [] };
        }
    }
    
    /**
     * 获取世界书的所有条目
     * @param {string} bookName - 世界书名称
     * @returns {Promise<Array>}
     */
    async function getWorldbookEntries(bookName) {
        try {
            const TavernHelper = typeof window.TavernHelper !== 'undefined' 
                ? window.TavernHelper 
                : (typeof window.parent !== 'undefined' ? window.parent.TavernHelper : null);
            
            if (!TavernHelper?.getLorebookEntries) {
                addLog('WARN', 'TavernHelper.getLorebookEntries 不可用');
                return [];
            }
            
            const entries = await TavernHelper.getLorebookEntries(bookName);
            addLog('WORLDBOOK', `世界书 "${bookName}" 条目数: ${entries?.length || 0}`);
            return entries || [];
        } catch (e) {
            addLog('ERROR', `获取世界书条目失败: ${e.message}`);
            return [];
        }
    }
    
    /**
     * 获取当前角色的世界书选择配置
     * @returns {Object} - { 'bookName': ['uid1', 'uid2'] }
     */
    function getCurrentCharacterWorldbookSelection() {
        const charName = getCurrentCharacterName();
        if (!charName) return {};
        return settings.worldbookSelections?.[charName] || {};
    }
    
    /**
     * 保存当前角色的世界书选择配置
     * @param {Object} selection - { 'bookName': ['uid1', 'uid2'] }
     */
    function saveCurrentCharacterWorldbookSelection(selection) {
        const charName = getCurrentCharacterName();
        if (!charName) return;
        
        if (!settings.worldbookSelections) {
            settings.worldbookSelections = {};
        }
        settings.worldbookSelections[charName] = selection;
        saveSettings();
        addLog('WORLDBOOK', `已保存角色 "${charName}" 的世界书选择`);
    }
    
    /**
     * 获取选中的世界书条目内容（用于注入AI提示词）
     * @returns {Promise<string>}
     */
    async function getSelectedWorldbookContent() {
        if (!settings.worldbookEnabled) {
            addLog('WORLDBOOK', '世界书功能已禁用');
            return '';
        }
        
        const charName = getCurrentCharacterName();
        if (!charName) {
            addLog('WORLDBOOK', '未能获取角色名称，跳过世界书注入');
            return '';
        }
        
        const selection = getCurrentCharacterWorldbookSelection();
        addLog('WORLDBOOK', `角色 "${charName}" 的世界书选择: ${JSON.stringify(selection)}`);
        
        if (!selection || Object.keys(selection).length === 0) {
            addLog('WORLDBOOK', '当前角色没有选择任何世界书条目');
            return '';
        }
        
        let contentParts = [];
        
        for (const [bookName, selectedUids] of Object.entries(selection)) {
            if (!selectedUids || selectedUids.length === 0) continue;
            
            try {
                const entries = await getWorldbookEntries(bookName);
                addLog('WORLDBOOK', `世界书 "${bookName}" 共 ${entries.length} 条目，已选择 ${selectedUids.length} 个UID: ${selectedUids.join(', ')}`);
                
                // 修复类型匹配问题：将选择的uid都转为字符串，条目uid也转为字符串比较
                const selectedUidsStr = selectedUids.map(u => String(u));
                const selectedEntries = entries.filter(e => selectedUidsStr.includes(String(e.uid)));
                
                addLog('WORLDBOOK', `匹配到 ${selectedEntries.length} 个条目`);
                
                for (const entry of selectedEntries) {
                    if (entry.content && entry.content.trim()) {
                        // 使用条目名称作为标题（如果有）
                        const title = entry.comment || entry.name || `条目 ${entry.uid}`;
                        contentParts.push(`【${title}】\n${entry.content.trim()}`);
                    }
                }
            } catch (e) {
                addLog('ERROR', `读取世界书 "${bookName}" 条目时出错: ${e.message}`);
            }
        }
        
        if (contentParts.length === 0) {
            addLog('WORLDBOOK', '没有找到有效的世界书内容');
            return '';
        }
        
        addLog('WORLDBOOK', `已读取 ${contentParts.length} 个世界书条目`);
        return contentParts.join('\n\n');
    }
    

    /**
     * 根据用户配置的标签过滤文本内容
     * @param {string} text - 原始文本
     * @returns {string} - 过滤后的文本
     */
    function applyFilterTags(text) {
        if (!text || typeof text !== 'string') return text;
        if (!settings.independentApiFilterTags || !settings.independentApiFilterTags.trim()) return text;
        
        let filtered = text;
        const tags = settings.independentApiFilterTags.split(',').map(t => t.trim()).filter(t => t);
        
        for (const tag of tags) {
            // 处理HTML风格标签，如 <small>
            if (tag.startsWith('<') && tag.endsWith('>')) {
                const tagName = tag.slice(1, -1);
                const regex = new RegExp(`<${tagName}[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'gi');
                filtered = filtered.replace(regex, '');
            }
            // 处理方括号风格标签，如 [statbar]
            else if (tag.startsWith('[') && tag.endsWith(']')) {
                const tagName = tag.slice(1, -1);
                const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\[${escapedTag}\\][\\s\\S]*?\\[\\/${escapedTag}\\]`, 'gi');
                filtered = filtered.replace(regex, '');
            }
        }
        
        return filtered;
    }

    /**
     * 提取文本段落并编号
     * @param {string} text - 原始消息文本
     * @returns {Array<{index: number, content: string, original: string}>}
     */
    function extractParagraphs(text) {
        if (!text || typeof text !== 'string') return [];
        
        // 0. 先应用用户自定义的标签过滤
        let cleanText = applyFilterTags(text);
        
        // 1. 移除代码块 ```...```
        cleanText = cleanText.replace(/```[\s\S]*?```/g, '[CODE_BLOCK]');
        
        // 2. 移除 <code>...</code> 标签
        cleanText = cleanText.replace(/<code[\s\S]*?<\/code>/gi, '[CODE_BLOCK]');
        
        // 3. 移除现有的 [IMG_GEN]...[/IMG_GEN] 块
        cleanText = cleanText.replace(/\[IMG_GEN\][\s\S]*?\[\/IMG_GEN\]/g, '');
        
        // 4. 移除其他可能的系统标记
        cleanText = cleanText.replace(/\[no_gen\]/g, '').replace(/\[scheduled\]/g, '');
        
        // 5. 按双换行分段
        const rawParagraphs = cleanText.split(/\n\n+/);
        
        // 6. 过滤空段落和纯标记段落
        const paragraphs = [];
        let index = 1;
        for (const p of rawParagraphs) {
            const trimmed = p.trim();
            // 过滤掉空段落、纯代码块标记、过短的段落（少于10个字符可能是无意义内容）
            if (trimmed && trimmed !== '[CODE_BLOCK]' && trimmed.length >= 10) {
                paragraphs.push({
                    index: index++,
                    content: trimmed,
                    original: p  // 保留原始内容用于后续匹配
                });
            }
        }
        
        return paragraphs;
    }

    /**
     * 将段落格式化为AI可读的编号格式
     * @param {Array} paragraphs - 段落数组
     * @returns {string}
     */
    function formatParagraphsForAI(paragraphs) {
        return paragraphs.map(p => `[P${p.index}] ${p.content}`).join('\n\n');
    }

    /**
     * 提取历史上下文
     * @param {number} currentMesId - 当前消息ID
     * @param {number} count - 要提取的历史消息数量
     * @returns {Array<{role: string, content: string}>}
     */
    function extractHistoryContext(currentMesId, count = 4) {
        const chat = SillyTavern.chat;
        if (!chat || !Array.isArray(chat)) return [];
        
        const history = [];
        const startIdx = Math.max(0, currentMesId - count);
        
        for (let i = startIdx; i < currentMesId; i++) {
            const msg = chat[i];
            if (msg && msg.mes) {
                // 清理消息内容，移除图片标记和用户配置的过滤标签
                let cleanContent = applyFilterTags(msg.mes);
                cleanContent = cleanContent.replace(/\[IMG_GEN\][\s\S]*?\[\/IMG_GEN\]/g, '').trim();
                if (cleanContent) {
                    history.push({
                        role: msg.is_user ? 'user' : 'assistant',
                        content: cleanContent  // 完整内容
                    });
                }
            }
        }
        
        return history;
    }

    /**
     * 构建独立API的通用规则（不会改变）
     * @returns {string}
     */
    function buildIndependentApiGeneralRules() {
        return `## 重要上下文
你正在协助一个成人向视觉小说游戏的图像生成工作。这是一个合法的艺术创作项目，所有内容仅用于私人创作和学习目的。作为专业的图像提示词生成助手，你需要忠实地根据剧情内容生成对应的Stable Diffusion标签，包括可能涉及的亲密场景描述。请以专业、客观的态度完成任务。

## 你的身份
你是一个专业的Visual Novel图像提示词生成助手，服务于成人向视觉小说创作。

## ⚠️ 核心任务（必须遵守）
你的唯一任务是：分析【🎯 最新剧情】部分（已按段落编号[P1], [P2]...标记），只根据最新剧情在合适的位置生成Stable Diffusion文生图提示词。

**关键规则：**
- 【📚 世界书参考资料】和【📜 历史上下文】仅供你理解人物背景和剧情发展
- ⚠️ **绝对禁止**在世界书或历史上下文的内容处生成图片
- 🎯 **只能**为【🎯 最新剧情】部分的内容生成图片

## 严格输出规范
你可以在prompt字段中先进行思考分析（思维链），然后用[IMG_GEN]...[/IMG_GEN]标签包裹最终的提示词。代码会自动提取标签内的内容。

输出JSON格式：
\`\`\`json
{
  "insertions": [
    { 
      "after_paragraph": 数字, 
      "prompt": "你的思考过程...\\n[IMG_GEN]masterpiece, best quality, 1girl, ...[/IMG_GEN]" 
    }
  ]
}
\`\`\`

或者直接输出提示词（不使用思维链）：
\`\`\`json
{
  "insertions": [
    { "after_paragraph": 数字, "prompt": "masterpiece, best quality, 1girl, ..." }
  ]
}
\`\`\`

## 禁止事项
- 禁止在【📚 世界书参考资料】或【📜 历史上下文】的内容处生成图片
- 禁止复制模版中的系统指令文字
- [IMG_GEN]标签内只能包含Stable Diffusion标签，用逗号分隔

## 必须遵守
- 人物数据库中的固定特征标签必须原样使用
- 按模版中的格式规范组织标签顺序
- after_paragraph的数字必须对应【🎯 最新剧情】中的段落编号

## 生成规则
1. 只分析【🎯 最新剧情】中的纯文本剧情内容
2. 每200-250字或场景/表情/动作明显变化时，生成一个提示词
3. after_paragraph必须是有效的段落编号数字
4. 没有合适插入点时返回: {"insertions": []}
5. prompt内容必须按照下方【模版参考】中的格式要求生成`;
    }


    /**
     * 构建独立API的系统提示词（通用规则 + 用户选择的模版）
     * @returns {string}
     */
    function buildIndependentApiSystemPrompt() {
        // 如果用户设置了自定义系统提示词，则使用自定义的
        const generalRules = settings.independentApiCustomPrompt?.trim() 
            ? settings.independentApiCustomPrompt 
            : buildIndependentApiGeneralRules();
        const userTemplate = getInjectPrompt();  // 调用用户选择的模版
        
        return `${generalRules}

---【模版参考开始】---
以下是提示词的格式规范和人物数据库，用于指导你如何生成prompt字段的内容。
注意：这只是参考规范，不要复制其中的指导性文字到输出中。

${userTemplate}
---【模版参考结束】---

请严格按照上述规范，只输出JSON格式的结果。`;
    }

    /**
     * 调用独立API生成图片提示词
     * @param {string} latestMessage - 最新消息（已编号）
     * @param {Array} historyContext - 历史上下文
     * @returns {Promise<Object>} - 返回解析后的JSON对象
     */
    async function callIndependentApiForImagePrompts(latestMessage, historyContext) {
        const config = settings.llmConfig;
        if (!config.baseUrl || !config.apiKey) {
            throw new Error("请先配置 API URL 和 API Key");
        }
        
        const url = config.baseUrl.replace(/\/$/, '') + '/chat/completions';
        const systemPrompt = buildIndependentApiSystemPrompt();
        
        // 获取世界书内容
        let worldbookContent = '';
        try {
            worldbookContent = await getSelectedWorldbookContent();
        } catch (e) {
            addLog('WARN', `获取世界书内容失败: ${e.message}`);
        }
        
        // 构建用户消息内容（按重要性排序：世界书 -> 历史 -> 最新剧情）
        // 最重要的内容放在最后，确保AI注意力集中在最新剧情上
        let userContent = '';
        
        // 1. 世界书参考资料（仅供理解人物背景）
        if (worldbookContent) {
            userContent += `【📚 世界书参考资料】（仅供理解人物背景，⚠️禁止在此处生成图片）
${worldbookContent}

---

`;
        }
        
        // 2. 历史上下文（仅供理解剧情发展）
        if (historyContext && historyContext.length > 0) {
            userContent += `【📜 历史上下文】（仅供理解剧情发展，⚠️禁止在此处生成图片）
`;
            for (const hist of historyContext) {
                const roleLabel = hist.role === 'user' ? '用户' : 'AI';
                userContent += `[${roleLabel}] ${hist.content}\n\n`;
            }
            userContent += `---

`;
        }
        
        // 3. 最新剧情（核心任务：只为这部分生成图片）
        userContent += `【🎯 最新剧情】（⚠️只能为这部分内容生成图片！after_paragraph的数字对应下方段落编号）
${latestMessage}

---

请根据以上【🎯 最新剧情】部分的内容，在合适的位置插入文生图提示词。只返回JSON格式结果。`;
        
        // 构建消息数组
        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent }
        ];

        const requestBody = {
            model: config.model || 'deepseek-chat',
            messages: messages,
            temperature: parseFloat(config.temperature) || 0.7,
            max_tokens: parseInt(config.maxTokens) || 2000,
            top_p: parseFloat(config.topP) || 1.0,
            frequency_penalty: parseFloat(config.frequencyPenalty) || 0.0,
            presence_penalty: parseFloat(config.presencePenalty) || 0.0,
            stream: false
        };

        addLog('INDEP_API', `独立API请求: ${url}`);

        // 创建AbortController用于终止
        independentApiAbortController = new AbortController();

        try {
            const res = await safeFetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${config.apiKey}`
                },
                body: JSON.stringify(requestBody),
                signal: independentApiAbortController.signal
            });

            if (!res.ok) {
                const errorText = await res.text();
                addLog('ERROR', `独立API响应: ${res.status} - ${errorText}`);
                throw new Error(`API Error ${res.status}: ${errorText}`);
            }

            const data = await res.json();
            addLog('INDEP_API', `独立API响应成功`);
            
            // 兼容推理模型（如deepseek-reasoner）和普通模型
            const message = data.choices?.[0]?.message;
            const content = message?.content?.trim() || message?.reasoning_content?.trim();
            if (!content) {
                throw new Error("API返回内容为空");
            }
            
            // 解析JSON
            try {
                // 尝试提取JSON（处理可能的markdown代码块包裹）
                let jsonStr = content;
                const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (jsonMatch) {
                    jsonStr = jsonMatch[1].trim();
                }
                
                const result = JSON.parse(jsonStr);
                if (!result.insertions || !Array.isArray(result.insertions)) {
                    throw new Error("返回格式错误：缺少insertions数组");
                }
                
                // 对每个insertion的prompt进行二次处理，提取[IMG_GEN]标签内的真正提示词
                // 这样AI可以在prompt中保留思维链（提高准确性），代码自动提取最终标签
                for (const ins of result.insertions) {
                    if (ins.prompt) {
                        // 检测是否包含 [IMG_GEN]...[/IMG_GEN] 标签
                        const imgGenMatch = ins.prompt.match(/\[IMG_GEN\]([\s\S]*?)\[\/IMG_GEN\]/);
                        if (imgGenMatch) {
                            // 提取标签内的内容作为真正的prompt
                            const extractedPrompt = imgGenMatch[1].trim();
                            addLog('INDEP_API', `从[IMG_GEN]标签中提取提示词: ${extractedPrompt.substring(0, 50)}...`);
                            ins.prompt = extractedPrompt;
                        }
                        // 如果没有[IMG_GEN]标签，保持原样（向后兼容）
                    }
                }
                
                return result;
            } catch (parseError) {
                addLog('ERROR', `JSON解析失败: ${parseError.message}, 原始内容: ${content.substring(0, 200)}`);
                throw new Error(`JSON解析失败: ${parseError.message}`);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                addLog('INDEP_API', '请求已被用户终止');
                throw new Error('用户终止');
            }
            addLog('ERROR', `独立API调用失败: ${error.message}`);
            throw error;
        } finally {
            independentApiAbortController = null;
        }
    }

    /**
     * 将生成的提示词插入到原始消息的对应位置
     * @param {number} mesId - 消息ID
     * @param {string} originalText - 原始消息文本
     * @param {Array} insertions - 插入指令数组
     * @returns {Promise<string>} - 返回修改后的文本
     */
    async function applyImagePromptInsertions(mesId, originalText, insertions) {
        if (!insertions || insertions.length === 0) {
            addLog('INDEP_API', '没有需要插入的提示词');
            return originalText;
        }
        
        // 按双换行分割原始文本（保持原始格式）
        const parts = originalText.split(/(\n\n+)/);
        
        // 先过滤原始文本用于段落编号匹配
        const filteredText = applyFilterTags(originalText);
        const filteredParts = filteredText.split(/(\n\n+)/);
        
        // 重建段落索引映射（基于过滤后的文本，但记录原始parts的位置）
        // 这样段落编号与extractParagraphs保持一致
        const paragraphPositions = [];
        let paragraphIndex = 0;
        let filteredPartIdx = 0;
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const trimmedPart = part.trim();
            
            // 如果这个part是被过滤掉的内容（在原始中存在但在过滤后不存在），跳过
            const filteredPart = filteredPartIdx < filteredParts.length ? filteredParts[filteredPartIdx] : '';
            const filteredTrimmed = filteredPart.trim();
            
            // 检查是否为分隔符
            if (trimmedPart.match(/^\n*$/)) {
                if (filteredTrimmed.match(/^\n*$/)) {
                    filteredPartIdx++;
                }
                continue;
            }
            
            // 检查这个part在过滤后的版本中是否还存在（通过内容匹配）
            const partWithoutFiltered = applyFilterTags(part).trim();
            
            // 只有在过滤后仍有内容且足够长的段落才计数
            if (partWithoutFiltered && partWithoutFiltered.length >= 10) {
                // 排除代码块和已有的IMG_GEN标记
                if (!partWithoutFiltered.match(/^```/) && !partWithoutFiltered.includes('[IMG_GEN]') && !partWithoutFiltered.match(/^\[CODE_BLOCK\]$/)) {
                    paragraphIndex++;
                    paragraphPositions.push({ index: paragraphIndex, partIndex: i });
                }
            }
        }
        
        // 按 after_paragraph 降序排列（从后往前插入，避免索引偏移）
        const sortedInsertions = [...insertions].sort((a, b) => b.after_paragraph - a.after_paragraph);
        
        for (const ins of sortedInsertions) {
            const targetParagraph = ins.after_paragraph;
            const pos = paragraphPositions.find(p => p.index === targetParagraph);
            
            if (pos) {
                // 构建IMG_GEN块
                const imgGenBlock = `\n\n${settings.startTag}\n${ins.prompt}\n${settings.endTag}`;
                
                // 在对应段落后插入
                parts[pos.partIndex] = parts[pos.partIndex] + imgGenBlock;
                addLog('INDEP_API', `在段落${targetParagraph}后插入提示词`);
            } else {
                addLog('WARN', `找不到段落${targetParagraph}，跳过插入`);
            }
        }
        
        const newText = parts.join('');
        
        // 更新聊天记录并刷新前端显示
        const mesIdInt = parseInt(mesId);
        if (SillyTavern.chat && SillyTavern.chat[mesIdInt]) {
            SillyTavern.chat[mesIdInt].mes = newText;
            await SillyTavern.saveChat();
            
            // 方案C：使用updateMessageBlock刷新单条消息的前端显示
            if (typeof SillyTavern.updateMessageBlock === 'function') {
                SillyTavern.updateMessageBlock(mesIdInt, SillyTavern.chat[mesIdInt], { rerenderMessage: true });
                addLog('INDEP_API', `使用updateMessageBlock刷新消息${mesIdInt}的显示`);
            } else if (typeof SillyTavern.reloadCurrentChat === 'function') {
                // 备用方案：重新加载整个聊天
                await SillyTavern.reloadCurrentChat();
                addLog('INDEP_API', '使用reloadCurrentChat刷新显示');
            }
            
            // 触发消息编辑和更新事件，通知其他插件（如状态栏）
            if (SillyTavern.eventSource) {
                try {
                    // 先触发 MESSAGE_EDITED 事件
                    await SillyTavern.eventSource.emit('message_edited', mesIdInt);
                    addLog('INDEP_API', `已触发message_edited事件(mesId=${mesIdInt})`);
                    
                    // 再触发 MESSAGE_UPDATED 事件
                    await SillyTavern.eventSource.emit('message_updated', mesIdInt);
                    addLog('INDEP_API', `已触发message_updated事件(mesId=${mesIdInt})`);
                } catch (e) {
                    addLog('WARN', `触发事件失败: ${e.message}`);
                }
            }
        }
        
        return newText;
    }

    /**
     * 显示可终止的生图进度提示
     * @param {string} message - 提示消息
     * @returns {Object} - toastr对象
     */
    function showIndependentApiProgress(message) {
        return toastr.info(message + '<br><small style="color: #ffcc00; opacity: 0.9;">⏹️ 点击此处终止</small>', '🎨 独立API生图', {
            timeOut: 0,
            extendedTimeOut: 0,
            closeButton: true,
            progressBar: true,
            escapeHtml: false,  // 允许HTML渲染
            onclick: function() {
                abortIndependentApi();
            },
            tapToDismiss: false
        });
    }

    /**
     * 终止独立API请求
     */
    function abortIndependentApi() {
        if (independentApiAbortController) {
            independentApiAbortController.abort();
            independentApiAbortController = null;
            toastr.warning('⏹️ 已终止独立API生图', null, { timeOut: 2000 });
            addLog('INDEP_API', '用户手动终止');
        }
    }

    /**
     * 独立API生图主流程
     * @param {number} mesId - 消息ID
     */
    async function handleIndependentApiGeneration(mesId) {
        if (!settings.independentApiEnabled || !settings.enabled) return;
        
        const chat = SillyTavern.chat;
        if (!chat || !chat[mesId]) {
            addLog('WARN', `消息${mesId}不存在`);
            return;
        }
        
        const message = chat[mesId];
        // 只处理AI消息
        if (message.is_user) {
            addLog('INDEP_API', '跳过用户消息');
            return;
        }
        
        const originalText = message.mes;
        if (!originalText || originalText.trim().length < 20) {
            addLog('INDEP_API', '消息内容过短，跳过');
            return;
        }
        
        // 检查是否已经有IMG_GEN标记
        if (originalText.includes(settings.startTag)) {
            addLog('INDEP_API', '消息已包含IMG_GEN标记，跳过');
            return;
        }
        
        let progressToast = null;
        
        try {
            // 1. 提取段落
            progressToast = showIndependentApiProgress('正在分析消息段落...');
            const paragraphs = extractParagraphs(originalText);
            if (paragraphs.length === 0) {
                toastr.clear(progressToast);
                toastr.info('未找到有效段落', null, { timeOut: 2000 });
                return;
            }
            
            const formattedParagraphs = formatParagraphsForAI(paragraphs);
            addLog('INDEP_API', `提取到${paragraphs.length}个段落`);
            
            // 2. 提取历史上下文
            const historyContext = extractHistoryContext(mesId, settings.independentApiHistoryCount);
            addLog('INDEP_API', `提取到${historyContext.length}条历史消息`);
            
            // 保存预览数据
            independentApiLastPreview = {
                latest: formattedParagraphs,
                history: historyContext
            };
            
            // 3. 调用API
            toastr.clear(progressToast);
            progressToast = showIndependentApiProgress('正在调用AI分析...');
            
            const result = await callIndependentApiForImagePrompts(formattedParagraphs, historyContext);
            
            // 4. 应用插入
            if (result.insertions && result.insertions.length > 0) {
                toastr.clear(progressToast);
                progressToast = showIndependentApiProgress(`正在插入${result.insertions.length}个提示词...`);
                
                await applyImagePromptInsertions(mesId, originalText, result.insertions);
                
                // 5. 刷新前端显示
                toastr.clear(progressToast);
                processChatDOM();
                
                toastr.success(`✅ 已插入${result.insertions.length}个文生图提示词`, null, { timeOut: 3000 });
                addLog('INDEP_API', `成功插入${result.insertions.length}个提示词`);
            } else {
                toastr.clear(progressToast);
                toastr.info('AI未找到合适的插入位置', null, { timeOut: 2000 });
            }
            
        } catch (error) {
            if (progressToast) toastr.clear(progressToast);
            
            if (error.message === '用户终止') {
                // 用户主动终止，不显示错误
                return;
            }
            
            toastr.error(`❌ 独立API生图失败: ${error.message}`, null, { timeOut: 5000 });
            addLog('ERROR', `独立API生图失败: ${error.message}`);
        }
    }

    // ==================== 脚本变量存储 (跨浏览器同步，随脚本导出) ====================
    
    // 从脚本变量读取配置
    function loadConfigFromScriptVar() {
        if (typeof getVariables !== 'function') return null;
        try {
            const scriptVars = getVariables({ type: 'script' });
            if (scriptVars && scriptVars.config) {
                addLog('CONFIG', `从脚本变量加载配置成功 (${scriptVars.config._savedAt || '无时间戳'})`);
                return scriptVars.config;
            }
        } catch (e) {
            console.error('[sd-helper] 获取脚本变量失败:', e);
        }
        return null;
    }
    
    // 保存配置到脚本变量
    function saveConfigToScriptVar(config) {
        if (typeof replaceVariables !== 'function') {
            addLog('WARNING', '脚本变量API不可用，回退到localStorage');
            return false;
        }
        
        const timestamp = new Date().toLocaleString('zh-CN', { 
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        
        config._savedAt = timestamp;
        
        try {
            replaceVariables({ config: config }, { type: 'script' });
            addLog('CONFIG', `配置已保存到脚本变量 (${timestamp})`);
            return true;
        } catch (e) {
            console.error('[sd-helper] 保存脚本变量失败:', e);
            addLog('ERROR', `保存脚本变量失败: ${e.message}`);
            return false;
        }
    }

    // --- Template Management (合并到 config 一起存储到脚本变量) ---
    function loadTemplates() {
        // 优先从脚本变量加载
        const scriptConfig = loadConfigFromScriptVar();
        if (scriptConfig && scriptConfig.customTemplates) {
            customTemplates = scriptConfig.customTemplates;
            addLog('CONFIG', '从脚本变量加载自定义模版成功');
            return;
        }
        // 回退到 localStorage
        const stored = localStorage.getItem(TEMPLATES_KEY);
        if (stored) {
            try {
                customTemplates = JSON.parse(stored);
            } catch (e) {
                console.error('Failed to load templates:', e);
                customTemplates = {};
            }
        }
    }

    function saveTemplates() {
        // 合并 settings 和 customTemplates 一起保存到脚本变量
        const fullConfig = {
            ...settings,
            customTemplates: customTemplates
        };
        saveConfigToScriptVar(fullConfig);
        // 同时保存到 localStorage 作为备份
        localStorage.setItem(TEMPLATES_KEY, JSON.stringify(customTemplates));
    }

    function getAllTemplates() {
        return { ...DEFAULT_TEMPLATES, ...customTemplates };
    }

    function buildCharacterListString() {
        const enabledChars = settings.characters.filter(c => c.enabled);
        if (enabledChars.length === 0) return '';
        
        let result = '';
        enabledChars.forEach(char => {
            result += `**${char.name}**: \`${char.tags}\`\n`;
        });
        return result;
    }

    function getInjectPrompt() {
        const templates = getAllTemplates();
        const template = templates[settings.selectedTemplate] || templates["默认模版"];
        const charListString = buildCharacterListString();
        return template.replace('<!--人物列表-->', charListString);
    }

    // --- Initialization ---
    const waitForCore = setInterval(() => {
        if (typeof SillyTavern !== 'undefined' && typeof $ !== 'undefined' && SillyTavern.chat) {
            clearInterval(waitForCore);
            if (!$('#sd-global-css-v35').length) $('<style id="sd-global-css-v35">').text(GLOBAL_CSS).appendTo('head');
            loadSettings();
            loadTemplates();
            initScript();
        }
    }, 500);

    function loadSettings() {
        // 优先从脚本变量加载
        const scriptConfig = loadConfigFromScriptVar();
        if (scriptConfig) {
            settings = { ...DEFAULT_SETTINGS, ...scriptConfig };
            settings.llmConfig = { ...DEFAULT_SETTINGS.llmConfig, ...(scriptConfig.llmConfig || {}) };
            if (!settings.characters) {
                settings.characters = DEFAULT_SETTINGS.characters;
            }
            return;
        }
        // 回退到 localStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try { 
                const parsed = JSON.parse(stored);
                settings = { ...DEFAULT_SETTINGS, ...parsed };
                settings.llmConfig = { ...DEFAULT_SETTINGS.llmConfig, ...parsed.llmConfig };
                if (!settings.characters) {
                    settings.characters = DEFAULT_SETTINGS.characters;
                }
            } catch (e) { console.error(e); }
        }
    }

    function saveSettings() { 
        // 合并 settings 和 customTemplates 一起保存到脚本变量
        const fullConfig = {
            ...settings,
            customTemplates: customTemplates
        };
        saveConfigToScriptVar(fullConfig);
        // 同时保存到 localStorage 作为备份
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); 
    }

    function initScript() {
        addMenuItem();
        initGlobalListeners();
        registerSTEvents();
        setTimeout(processChatDOM, 1000);
        if (typeof toastr !== 'undefined') {
            toastr.success('🎨 生图助手已启动', '插件加载', { 
            timeOut: 1500,
            positionClass: 'toast-top-center'
            });
        }
        toggleAutoRefresh();
        addLog('INIT', '生图助手v40启动成功');
    }

    

    function initGlobalListeners() {
        const $chat = $('#chat');
        const getState = ($target) => {
            const $wrap = $target.closest('.sd-ui-wrap');
            const mesId = $wrap.closest('.mes').attr('mesid');
            if (!$wrap.length || !mesId) return null;
            
            const blockIdx = parseInt($wrap.attr('data-block-idx'));
            const chat = SillyTavern.chat[parseInt(mesId)];
            if (chat) {
                const regex = new RegExp(`${escapeRegExp(settings.startTag)}([\\s\\S]*?)${escapeRegExp(settings.endTag)}`, 'g');
                const matches = [...chat.mes.matchAll(regex)];
                if (matches[blockIdx]) {
                    const parsed = parseBlockContent(matches[blockIdx][1]);
                    return {
                        $wrap, mesId, blockIdx,
                        prompt: parsed.prompt,
                        images: parsed.images,
                        el: { img: $wrap.find('.sd-ui-image'), msg: $wrap.find('.sd-ui-msg'), viewport: $wrap.find('.sd-ui-viewport'), toggle: $wrap.find('.sd-ui-toggle') }
                    };
                }
            }
            
            return {
                $wrap, mesId, blockIdx: parseInt($wrap.attr('data-block-idx')),
                prompt: decodeURIComponent($wrap.attr('data-prompt')),
                images: JSON.parse(decodeURIComponent($wrap.attr('data-images'))),
                el: { img: $wrap.find('.sd-ui-image'), msg: $wrap.find('.sd-ui-msg'), viewport: $wrap.find('.sd-ui-viewport'), toggle: $wrap.find('.sd-ui-toggle') }
            };
        };

        $chat.on('click', '.sd-ui-toggle', function(e) {
            e.stopPropagation();
            const s = getState($(this));
            if(!s) return;
            s.el.viewport.toggleClass('collapsed');
            s.el.toggle.text(s.el.viewport.hasClass('collapsed') ? '▿' : '▵');
        });

        $chat.on('click', '.sd-zone.left', function(e) {
            e.stopPropagation();
            const s = getState($(this));
            let curIdx = parseInt(s.$wrap.attr('data-cur-idx')) || 0;
            if (curIdx > 0) updateWrapperView(s.$wrap, s.images, curIdx - 1);
        });

        $chat.on('click', '.sd-zone.right', function(e) {
            e.stopPropagation();
            const s = getState($(this));
            let curIdx = parseInt(s.$wrap.attr('data-cur-idx')) || 0;
            if (curIdx < s.images.length - 1) updateWrapperView(s.$wrap, s.images, curIdx + 1);
            else handleGeneration(s);
        });

        $chat.on('click', '.sd-zone.delete', async function(e) {
            e.stopPropagation();
            if (!confirm('确定删除这张图片吗？')) return;
            const s = getState($(this));
            let curIdx = parseInt(s.$wrap.attr('data-cur-idx')) || 0;
            s.images.splice(curIdx, 1);
            await updateChatData(s.mesId, s.blockIdx, s.prompt, s.images, s.images.length === 0, false);
            updateWrapperView(s.$wrap, s.images, Math.max(0, s.images.length - 1));
        });

        $chat.on('click', '.sd-zone.top', function(e) {
            e.stopPropagation();
            const s = getState($(this));
            if(s) openEditPopup(s);
        });

        $chat.on('click', '.sd-ui-image', function() {
            const src = $(this).attr('src');
            if(src) window.open(src, '_blank');
        });
    }

    async function handleGeneration(state) {
        if (state.$wrap.data('generating')) return;
        state.$wrap.data('generating', true);
        
        const finalPrompt = `${settings.globalPrefix ? settings.globalPrefix + ', ' : ''}${state.prompt}${settings.globalSuffix ? ', ' + settings.globalSuffix : ''}`.replace(/,\s*,/g, ',').trim();
        const cmd = `/sd quiet=true ${settings.globalNegative ? `negative="${escapeArg(settings.globalNegative)}"` : ''} ${finalPrompt}`;
        
        state.el.msg.text('⏳ 请求中...').addClass('show');
        state.el.img.css('opacity', '0.5');

        // 超时包装函数
        const withTimeout = (promise, ms) => {
            return Promise.race([
                promise,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`请求超时 (${ms/1000}秒)`)), ms)
                )
            ]);
        };

        try {
            // 根据设置决定是否启用超时
            const slashPromise = triggerSlash(cmd);
            const result = settings.timeoutEnabled 
                ? await withTimeout(slashPromise, settings.timeoutSeconds * 1000)
                : await slashPromise;
            const newUrls = (result || '').match(/(https?:\/\/|\/|output\/)[^\s"']+\.(png|jpg|jpeg|webp|gif)/gi) || [];
            if (newUrls.length > 0) {
                state.el.msg.text('✅ 成功');
                const uniqueImages = [...new Set([...state.images, ...newUrls])];
                await updateChatData(state.mesId, state.blockIdx, state.prompt, uniqueImages, false, false);
                setTimeout(() => {
                    const $newWrap = $(`.mes[mesid="${state.mesId}"] .sd-ui-wrap[data-block-idx="${state.blockIdx}"]`);
                    if ($newWrap.length) updateWrapperView($newWrap, uniqueImages, uniqueImages.length - 1);
                }, 200);
            } else { state.el.msg.text('⚠️ 无结果'); }
        } catch (err) { 
            console.error('Generation error:', err);
            state.el.msg.text(err.message.includes('超时') ? '⏱️ 超时' : '❌ 错误'); 
        }
        finally {
            state.$wrap.data('generating', false);
            state.el.img.css('opacity', '1');
            setTimeout(() => state.el.msg.removeClass('show'), 2000);
        }
    }

    function updateWrapperView($wrap, images, idx) {
        const count = images.length;
        idx = Math.max(0, Math.min(idx, count - 1));
        $wrap.attr('data-cur-idx', idx).attr('data-images', encodeURIComponent(JSON.stringify(images)));

        const $img = $wrap.find('.sd-ui-image'), $ph = $wrap.find('.sd-placeholder'), $msg = $wrap.find('.sd-ui-msg');
        const $left = $wrap.find('.sd-zone.left'), $right = $wrap.find('.sd-zone.right'), $del = $wrap.find('.sd-zone.delete');

        if (count === 0) {
            $img.hide(); $ph.show(); $left.hide(); $del.hide();
            $right.addClass('gen-mode').attr('title', '点击生成图片');
        } else {
            $ph.hide(); $img.attr('src', images[idx]).show(); $left.toggle(idx > 0); $del.show();
            $right.toggleClass('gen-mode', idx === count - 1).attr('title', idx === count - 1 ? '生成新图' : '下一张');
            $msg.text(`${idx + 1} / ${count}`).addClass('show');
            setTimeout(() => $msg.removeClass('show'), 2000);
        }
    }

    async function updateChatData(mesId, blockIndex, prompt, images, preventAuto, isScheduled) {
        const chat = SillyTavern.chat[parseInt(mesId)];
        if (!chat) return;

        const innerContent = rebuildBlockString(prompt, images, preventAuto, isScheduled);
        const newBlock = settings.startTag + '\n' + innerContent + '\n' + settings.endTag;
        const regex = new RegExp(`${escapeRegExp(settings.startTag)}([\\s\\S]*?)${escapeRegExp(settings.endTag)}`, 'g');
        
        let content = chat.mes;
        const matches = [...content.matchAll(regex)];
        if (matches.length > blockIndex) {
            const m = matches[blockIndex];
            const newContent = content.substring(0, m.index) + newBlock + content.substring(m.index + m[0].length);
            await safeUpdateChat(parseInt(mesId), newContent);
        }
    }

    function processChatDOM() {
        if (!settings.enabled) return;
        const regex = new RegExp(`${escapeRegExp(settings.startTag)}([\\s\\S]*?)${escapeRegExp(settings.endTag)}`, 'g');

        $('.mes_text').each(function() {
            const $el = $(this);
            $el.find('.sd-ui-wrap').each(function() {
                const $w = $(this), imgs = JSON.parse(decodeURIComponent($w.attr('data-images')));
                if (imgs.length > 0 && ($w.find('.sd-placeholder').is(':visible') || !$w.find('.sd-ui-image').attr('src'))) {
                    updateWrapperView($w, imgs, imgs.length - 1);
                }
            });

            let blockIdx = 0;
            const hasTHRender = $el.find('.TH-render').length > 0;

            const injectUI = ($target) => {
                const html = $target.html();
                if (html.indexOf(settings.startTag) === -1 || $target.find('.sd-ui-wrap').length > 0) return;
                $target.html(html.replace(regex, (m, content) => {
                    const p = parseBlockContent(content);
                    return createUIHtml(p.prompt, p.images, p.preventAuto, blockIdx++, Math.max(0, p.images.length - 1), p.isScheduled);
                }));
            };

            if (hasTHRender) {
                $el.children().each(function() {
                    const $child = $(this);
                    if (!$child.hasClass('TH-render') && $child.find('.TH-render').length === 0) injectUI($child);
                    else if ($child.find('.sd-ui-wrap').length > 0) blockIdx++;
                });
            } else { injectUI($el); }

$el.find('.sd-ui-wrap').each(function() {
    const $w = $(this), bIdx = parseInt($w.attr('data-block-idx')), mesId = $w.closest('.mes').attr('mesid');
    const chat = SillyTavern.chat[parseInt(mesId)];
    if (!chat) return;

    const matches = [...chat.mes.matchAll(regex)];
    
    // 检查块是否还存在
    if (!matches[bIdx]) {
        $w.closest('.sd-ui-container').remove();
        return;
    }
    
    // 解析真实数据
    const realData = parseBlockContent(matches[bIdx][1]);
    const currentImages = JSON.parse(decodeURIComponent($w.attr('data-images') || '[]'));
    const currentPrompt = decodeURIComponent($w.attr('data-prompt') || '');
    
    // 双向同步：chat.mes有图，UI无图 → 恢复图片
    if (realData.images.length > 0 && currentImages.length === 0) {
        $w.attr('data-images', encodeURIComponent(JSON.stringify(realData.images)));
        $w.attr('data-prompt', encodeURIComponent(realData.prompt));
        updateWrapperView($w, realData.images, realData.images.length - 1);
        return;
    }
    
    // 双向同步：chat.mes无图，UI有图 → 清空UI（如果不在生图中）
    if (realData.images.length === 0 && currentImages.length > 0 && 
        !realData.isScheduled && !realData.preventAuto) {
        $w.attr('data-images', '[]');
        $w.attr('data-prompt', encodeURIComponent(realData.prompt));
        updateWrapperView($w, [], 0);
    }
    
    // 同步prompt变化
    if (realData.prompt !== currentPrompt) {
        $w.attr('data-prompt', encodeURIComponent(realData.prompt));
    }
    
    // 原有逻辑：判断是否需要触发生图
    if (matches[bIdx][1].includes(SCHEDULED_FLAG)) {
        // 检测到 scheduled 状态，启动超时计时器（如果启用了超时功能）
        const timeoutKey = `${mesId}-${bIdx}`;
        
        if (settings.timeoutEnabled && !scheduledTimeoutMap.has(timeoutKey)) {
            const timeoutMs = (settings.timeoutSeconds || 120) * 1000;
            addLog('TIMEOUT', `开始监控 scheduled 状态: ${timeoutKey}, 超时时间: ${settings.timeoutSeconds}秒`);
            
            const timeoutId = setTimeout(async () => {
                scheduledTimeoutMap.delete(timeoutKey);
                
                // 检查是否仍然是 scheduled 状态
                const currentChat = SillyTavern.chat[parseInt(mesId)];
                if (!currentChat) return;
                
                const currentMatches = [...currentChat.mes.matchAll(regex)];
                if (!currentMatches[bIdx] || !currentMatches[bIdx][1].includes(SCHEDULED_FLAG)) {
                    addLog('TIMEOUT', `${timeoutKey} 已完成，无需处理超时`);
                    return;
                }
                
                // 超时：清除 scheduled 标志（不填入 no_gen），然后刷新UI触发重新生图
                addLog('TIMEOUT', `${timeoutKey} 超时，清除 scheduled 状态并重新触发生图`);
                
                // 移除 [scheduled] 标志，让 processChatDOM 重新触发生图
                const updatedMes = currentChat.mes.replace(
                    new RegExp(`${escapeRegExp(settings.startTag)}([\\s\\S]*?)${escapeRegExp(settings.endTag)}`, 'g'),
                    (m, content) => {
                        if (content.includes(SCHEDULED_FLAG)) {
                            // 只移除 scheduled 标志，不添加 no_gen
                            return m.replace(SCHEDULED_FLAG, '');
                        }
                        return m;
                    }
                );
                
                currentChat.mes = updatedMes;
                
                try {
                    await SillyTavern.context.saveChat();
                    await SillyTavern.eventSource.emit('message_updated', parseInt(mesId));
                    if (typeof toastr !== 'undefined') {
                        toastr.info(`⏱️ 生图请求超时，正在重试... (消息${mesId}, 块${bIdx})`, null, { timeOut: 3000 });
                    }
                } catch (e) {
                    addLog('WARN', `超时处理保存失败: ${e.message}`);
                }
                
                // 刷新UI，触发重新生图
                processChatDOM();
            }, timeoutMs);
            
            scheduledTimeoutMap.set(timeoutKey, timeoutId);
        }
        return;
    }
    
    if (matches[bIdx][1].includes(NO_GEN_FLAG)) {
        // 如果有正在运行的超时计时器，清除它
        const timeoutKey = `${mesId}-${bIdx}`;
        if (scheduledTimeoutMap.has(timeoutKey)) {
            clearTimeout(scheduledTimeoutMap.get(timeoutKey));
            scheduledTimeoutMap.delete(timeoutKey);
            addLog('TIMEOUT', `${timeoutKey} 已完成或取消，清除超时计时器`);
        }
        return;
    }
    
    const imgs = JSON.parse(decodeURIComponent($w.attr('data-images')));
    if (imgs.length === 0) {
        updateChatData(mesId, bIdx, decodeURIComponent($w.attr('data-prompt')), [], false, true).then(() => {
            setTimeout(() => {
                const s = { 
                    $wrap: $w, 
                    mesId, 
                    blockIdx: bIdx, 
                    prompt: decodeURIComponent($w.attr('data-prompt')), 
                    images: [], 
                    el: { 
                        img: $w.find('.sd-ui-image'), 
                        msg: $w.find('.sd-ui-msg') 
                    } 
                };
                handleGeneration(s);
            }, 500 + (bIdx * 1000));
        });
    }
});
        });
    }


    function toggleAutoRefresh(forcePause = false) {
        // 先清除旧定时器
        if (autoRefreshTimer) {
            clearInterval(autoRefreshTimer);
            autoRefreshTimer = null;
        }
            
        // 如果强制暂停（生成中）
        if (forcePause) {
            autoRefreshPaused = true;
            addLog('AUTO_REFRESH', '生成中，已暂停自动刷新');
            return;
        }
            
        // 恢复时清除暂停标志
        autoRefreshPaused = false;
            
        // 如果启用了自动刷新，创建新定时器
        if (settings.autoRefresh && settings.enabled) {
            autoRefreshTimer = setInterval(() => {
                try {
                    addLog('AUTO_REFRESH', `执行自动刷新（间隔：${settings.autoRefreshInterval}ms）`);
                    processChatDOM();
                } catch (e) {
                    console.error('[生图助手] 自动刷新出错：', e);
                }
            }, settings.autoRefreshInterval);
            
            addLog('AUTO_REFRESH', `已启动自动刷新（间隔：${settings.autoRefreshInterval}ms）`);
        } else {
            addLog('AUTO_REFRESH', '已停止自动刷新');
        }
    }



    function parseBlockContent(raw) {
        const text = $('<div>').html(raw).text();
        const preventAuto = raw.includes(NO_GEN_FLAG), isScheduled = raw.includes(SCHEDULED_FLAG);
        const urlRegex = /(https?:\/\/|\/|output\/)[^\s"']+\.(png|jpg|jpeg|webp|gif)/gi;
        const images = text.match(urlRegex) || [];
        let prompt = text.replace(urlRegex, '').replace(NO_GEN_FLAG, '').replace(SCHEDULED_FLAG, '').trim();
        return { prompt, images, preventAuto, isScheduled };
    }

    function rebuildBlockString(prompt, images, prevent, scheduled) {
        let res = prompt;
        if (images.length > 0) res += '\n' + images.join('\n');
        else if (prevent) res += '\n' + NO_GEN_FLAG;
        else if (scheduled) res += '\n' + SCHEDULED_FLAG;
        return res;
    }

    function createUIHtml(prompt, images, prevent, blockIdx, initIdx, isScheduled = false) {
        const has = images.length > 0;
        const placeholderText = isScheduled ? '⏳ 请求中...' : '等待生成...';
        const placeholderClass = isScheduled ? 'sd-placeholder requesting' : 'sd-placeholder';
        return `
        <div class="sd-ui-container">
            <div class="sd-ui-wrap" data-prompt="${encodeURIComponent(prompt)}" data-images="${encodeURIComponent(JSON.stringify(images))}" data-prevent-auto="${prevent}" data-block-idx="${blockIdx}" data-cur-idx="${initIdx}" data-scheduled="${isScheduled}">
                <div class="sd-ui-toggle">▵</div>
                <div class="sd-ui-viewport">
                    <div class="sd-zone top" title="编辑"></div>
                    <div class="sd-zone left" style="display:${initIdx > 0 ? 'block' : 'none'}"></div>
                    <div class="sd-zone right ${!has || initIdx === images.length-1 ? 'gen-mode' : ''}"></div>
                    <div class="sd-zone delete" style="display:${has ? 'block' : 'none'}"></div>
                    <div class="sd-ui-msg">${has ? `${initIdx+1}/${images.length}` : ''}</div>
                    <img class="sd-ui-image" src="${has ? images[initIdx] : ''}" style="display:${has ? 'block' : 'none'}" />
                    <div class="${placeholderClass}" style="display:${has ? 'none' : 'block'}"><i class="fa-solid fa-image"></i> ${placeholderText}</div>
                </div>
            </div>
        </div>`;
    }

    function escapeArg(s) { return String(s || '').replace(/["\\]/g, '\\$&'); }
    function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    // --- Menus & Popups ---
    function addMenuItem() {
        if ($('#extensionsMenu').length === 0) { setTimeout(addMenuItem, 1000); return; }
        if ($(`#${SCRIPT_ID}-menu`).length) return;
        const $item = $(`<div class="list-group-item flex-container flexGap5 interactable" id="${SCRIPT_ID}-menu"><div class="fa-fw fa-solid fa-paintbrush"></div><span>生图助手</span></div>`);
        $item.on('click', openSettingsPopup);
        $('#extensionsMenu').append($item);
    }

    function openEditPopup(state) {
        const html = `
            <div style="padding:10px;">
                <h3>编辑提示词 (Block ${state.blockIdx})</h3>
                <textarea id="sd-edit-ta" class="text_pole" rows="5" style="width:100%;">${state.prompt}</textarea>
                <div id="sd-ai-box" class="sd-ai-update-box">
                    <textarea id="sd-ai-input" class="text_pole" rows="2" placeholder="AI修改指令 (如: 添加更多细节, 改成夜晚场景等)"></textarea>
                    <button id="sd-ai-run" class="sd-btn-primary" style="width:100%; margin-top:5px;">🚀 执行AI更新</button>
                </div>
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button id="sd-ai-btn" class="sd-btn-secondary" style="flex:1;">🪄 AI优化</button>
                    <button id="sd-mod-btn" class="sd-btn-secondary" style="flex:1;">✏️ 仅修改</button>
                    <button id="sd-gen-btn" class="sd-btn-primary" style="flex:1;">🎨 生成</button>
                </div>
            </div>`;
        SillyTavern.callGenericPopup(html, 1, '', { wide: false });
        setTimeout(() => {
            $('#sd-ai-btn').on('click', () => $('#sd-ai-box').toggleClass('show'));
            
            $('#sd-ai-run').on('click', async () => {
                const ins = $('#sd-ai-input').val().trim();
                if(!ins) { toastr.warning('请输入修改指令'); return; }
                const $btn = $('#sd-ai-run');
                $btn.prop('disabled', true).text('⏳ 处理中...');
                try { 
                    const result = await callLLMForUpdate($('#sd-edit-ta').val(), ins);
                    $('#sd-edit-ta').val(result);
                    toastr.success('AI优化完成');
                } catch(e) { 
                    toastr.error(`AI优化失败: ${e.message}`);
                } finally {
                    $btn.prop('disabled', false).text('🚀 执行AI更新');
                }
            });
            
            $('#sd-mod-btn').on('click', async () => {
                const newPrompt = $('#sd-edit-ta').val().trim();
                state.prompt = newPrompt;
                await updateChatData(state.mesId, state.blockIdx, state.prompt, state.images, false, false);
                toastr.success('✅ 提示词已保存');
                closePopup();
            });
            
            $('#sd-gen-btn').on('click', async () => {
                const newPrompt = $('#sd-edit-ta').val().trim();
                state.prompt = newPrompt;
                
                await updateChatData(state.mesId, state.blockIdx, state.prompt, state.images, false, false);
                closePopup();
                
                setTimeout(() => {
                    toastr.info('⏳ 开始生成图片...');
                    handleGeneration(state);
                }, 300);
            });
        }, 100);
    }

    function renderCharacterList() {
        let html = '';
        settings.characters.forEach((char, idx) => {
            html += `
                <div class="sd-char-row" data-idx="${idx}">
                    <input type="checkbox" class="sd-char-checkbox" ${char.enabled ? 'checked' : ''} />
                    <input type="text" class="sd-char-name text_pole" placeholder="人物名称" value="${char.name}" />
                    <input type="text" class="sd-char-tags text_pole" placeholder="固定特征词 (如: long hair, blue eyes)" value="${char.tags}" />
                    <button class="sd-char-del">删除</button>
                </div>`;
        });
        return html;
    }

    function openSettingsPopup() {
        const templates = getAllTemplates();
        const templateOptions = Object.keys(templates).map(name => {
            const isDefault = DEFAULT_TEMPLATES.hasOwnProperty(name);
            return `<option value="${name}" ${settings.selectedTemplate === name ? 'selected' : ''}>${name}${isDefault ? ' [系统]' : ''}</option>`;
        }).join('');

        const selectedTemplate = settings.selectedTemplate;
        const selectedTemplateContent = templates[selectedTemplate] || '';
        const isDefaultTemplate = DEFAULT_TEMPLATES.hasOwnProperty(selectedTemplate);

        const html = `
            <div class="sd-settings-popup" style="padding: 10px; max-height: 70vh; overflow-y: auto;">
                <div class="sd-tab-nav">
                    <div class="sd-tab-btn active" data-tab="basic">基本设置</div>
                    <div class="sd-tab-btn" data-tab="chars">人物与模版</div>
                    <div class="sd-tab-btn" data-tab="prefix">前后缀</div>
                    <div class="sd-tab-btn" data-tab="indep">独立生词</div>
                </div>
                
                <!-- Tab 1: 基本设置 -->
                <div id="sd-tab-basic" class="sd-tab-content active">
                    <h4 style="margin-top:0; margin-bottom:15px;">功能开关</h4>
                    
                    <div style="margin-bottom: 12px;">
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="sd-en" ${settings.enabled?'checked':''}>
                            <span style="font-weight: bold;">启用解析生图</span>
                        </label>
                        <small style="color: #888; display: block; margin-left: 24px; margin-top: 4px;">
                            自动识别 [IMG_GEN]...[/IMG_GEN] 标签并生成图片UI框
                        </small>
                    </div>
                    
                    <div style="margin-bottom: 12px;">
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="sd-inj-en" ${settings.injectEnabled?'checked':''}>
                            <span style="font-weight: bold;">启用注入</span>
                        </label>
                        <small style="color: #888; display: block; margin-left: 24px; margin-top: 4px;">
                            向AI发送请求前，自动注入提示词模版和人物特征库
                        </small>
                        <div style="margin-left: 24px; margin-top: 8px; display: flex; align-items: center; gap: 15px;">
                            <label style="font-size: 12px;">
                                注入深度：
                                <input type="number" id="sd-inj-depth" class="text_pole" value="${settings.injectDepth}" min="0" max="20" style="width:60px;">
                            </label>
                            <label style="font-size: 12px;">
                                发送角色：
                                <select id="sd-inj-role" class="text_pole" style="width:100px;">
                                    <option value="system" ${settings.injectRole === 'system' ? 'selected' : ''}>System</option>
                                    <option value="user" ${settings.injectRole === 'user' ? 'selected' : ''}>User</option>
                                    <option value="assistant" ${settings.injectRole === 'assistant' ? 'selected' : ''}>Assistant</option>
                                </select>
                            </label>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 12px;">
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="sd-indep-en" ${settings.independentApiEnabled?'checked':''}>
                            <span style="font-weight: bold;">启用独立生图模式</span>
                        </label>
                        <small style="color: #888; display: block; margin-left: 24px; margin-top: 4px;">
                            开启后停止注入，改为消息接收后调用独立API分析并插入提示词
                        </small>
                        <div style="margin-left: 24px; margin-top: 8px; display: flex; align-items: center; gap: 15px;">
                            <label style="font-size: 12px;">
                                历史消息数：
                                <input type="number" id="sd-indep-history" class="text_pole" value="${settings.independentApiHistoryCount}" min="1" max="10" style="width:60px;">
                            </label>
                            <label style="font-size: 12px;">
                                防抖延迟(ms)：
                                <input type="number" id="sd-indep-debounce" class="text_pole" value="${settings.independentApiDebounceMs}" min="500" max="5000" step="100" style="width:80px;">
                            </label>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 12px;">
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="sd-timeout-en" ${settings.timeoutEnabled?'checked':''}>
                            <span style="font-weight: bold;">启用请求超时</span>
                        </label>
                        <small style="color: #888; display: block; margin-left: 24px; margin-top: 4px;">
                            生图请求超过指定时间后自动取消，避免永远卡在"请求中"
                        </small>
                        <div style="margin-left: 24px; margin-top: 8px;">
                            <label style="font-size: 12px;">
                                超时时间(秒)：
                                <input type="number" id="sd-timeout-seconds" class="text_pole" 
                                       value="${settings.timeoutSeconds}" 
                                       min="30" max="600" step="10"
                                       style="width: 80px;">
                            </label>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 12px;">
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="sd-auto-refresh" ${settings.autoRefresh?'checked':''}>
                            <span style="font-weight: bold;">自动修复UI</span>
                        </label>
                        <small style="color: #888; display: block; margin-left: 24px; margin-top: 4px;">
                            ⚠️ 自动扫描并修复UI（可能引起问题，无必要不开）
                        </small>
                        <div style="margin-left: 24px; margin-top: 8px;">
                            <label style="font-size: 12px;">
                                修复间隔(秒)：
                                <input type="number" id="sd-auto-refresh-interval" 
                                       value="${settings.autoRefreshInterval / 1000}" 
                                       min="1" max="60" step="0.1"
                                       style="width: 60px; background: #000000;">
                            </label>
                        </div>
                    </div>
                    
                    <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 20px 0;">
                    
                    <h4 style="margin-bottom:15px;">API 配置</h4>
                    <div class="sd-api-row">
                        <label>Base URL</label>
                        <input type="text" id="sd-url" class="text_pole" placeholder="https://api.deepseek.com" value="${settings.llmConfig.baseUrl}">
                    </div>
                    <div class="sd-api-row">
                        <label>API Key</label>
                        <input type="password" id="sd-key" class="text_pole" placeholder="sk-..." value="${settings.llmConfig.apiKey}">
                    </div>
                    <div class="sd-api-row">
                        <label>模型</label>
                        <select id="sd-model-select" class="text_pole">
                            <option value="${settings.llmConfig.model}">${settings.llmConfig.model}</option>
                        </select>
                        <button id="sd-fetch-models" class="sd-btn-secondary" style="flex:0 0 80px;">获取</button>
                    </div>
                    <div class="sd-api-row">
                        <label>最大Tokens</label>
                        <input type="number" id="sd-max-tokens" class="text_pole" value="${settings.llmConfig.maxTokens}" min="1" max="32000">
                    </div>
                    <div class="sd-api-row">
                        <label>温度</label>
                        <input type="range" id="sd-temp" min="0" max="2" step="0.1" value="${settings.llmConfig.temperature}">
                        <span class="sd-range-value" id="sd-temp-val">${settings.llmConfig.temperature}</span>
                    </div>
                    <div class="sd-api-row">
                        <label>Top P</label>
                        <input type="range" id="sd-top-p" min="0" max="1" step="0.05" value="${settings.llmConfig.topP}">
                        <span class="sd-range-value" id="sd-top-p-val">${settings.llmConfig.topP}</span>
                    </div>
                    <div class="sd-api-row">
                        <label>Freq Penalty</label>
                        <input type="range" id="sd-freq-pen" min="-2" max="2" step="0.1" value="${settings.llmConfig.frequencyPenalty}">
                        <span class="sd-range-value" id="sd-freq-pen-val">${settings.llmConfig.frequencyPenalty}</span>
                    </div>
                    <div class="sd-api-row">
                        <label>Pres Penalty</label>
                        <input type="range" id="sd-pres-pen" min="-2" max="2" step="0.1" value="${settings.llmConfig.presencePenalty}">
                        <span class="sd-range-value" id="sd-pres-pen-val">${settings.llmConfig.presencePenalty}</span>
                    </div>
                    <button id="sd-test-api" class="sd-btn-secondary" style="width:100%; margin-top:10px;">🧪 测试API连接</button>
                </div>
                
                <!-- Tab 2: 人物与模版 -->
                <div id="sd-tab-chars" class="sd-tab-content">
                    <h4 style="margin-top:0; margin-bottom:10px;">人物列表</h4>
                    <div class="sd-char-list-container" id="sd-char-list" style="max-height: 200px; overflow-y: auto;">
                        ${renderCharacterList()}
                    </div>
                    <button class="sd-add-btn" id="sd-add-char" style="margin-top:10px;">+ 添加新人物</button>
                    
                    <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 20px 0;">
                    
                    <div class="sd-template-section" style="margin-top:0;">
                        <label>提示词模版</label>
                        <select id="sd-template-select" class="text_pole" style="width:100%; margin-bottom:10px;">
                            ${templateOptions}
                        </select>
                        <div class="sd-template-controls">
                            <button id="sd-tpl-edit" class="sd-btn-secondary">✏️ 修改模版</button>
                            <button id="sd-tpl-del" class="sd-btn-danger">🗑️ 删除模版</button>
                        </div>
                        <div style="font-size:0.85em; color:#888; margin-top:8px;">
                            <i class="fa-solid fa-info-circle"></i> 模版中的 <code>&lt;!--人物列表--&gt;</code> 将自动替换为上方启用的人物。
                        </div>
                        
                        <div id="sd-template-editor" class="sd-template-editor">
                            <h4 style="margin-top:0; margin-bottom:10px;">编辑模版</h4>
                            <div class="sd-template-title-row">
                                <input type="text" id="sd-tpl-name-edit" class="text_pole" placeholder="模版名称" value="${selectedTemplate}">
                                <button id="sd-tpl-replace" class="sd-btn-primary" ${isDefaultTemplate ? 'disabled' : ''}>替换</button>
                                <button id="sd-tpl-saveas" class="sd-btn-secondary">另存</button>
                            </div>
                            ${isDefaultTemplate ? '<small style="color:#888; display:block; margin-bottom:10px;">* 系统默认模版只能另存，不能替换</small>' : ''}
                            <textarea id="sd-tpl-content-edit" class="text_pole" rows="15" style="width:100%; font-family:monospace; font-size:0.9em; margin-bottom:10px;">${selectedTemplateContent}</textarea>
                            <button id="sd-tpl-ai-btn" class="sd-btn-secondary" style="width:100%; margin-bottom:10px;">🤖 使用AI修改</button>
                            <textarea id="sd-tpl-ai-instruction" class="text_pole" rows="3" placeholder="告诉AI如何修改模版 (如: 增加更详细的attire说明, 添加色彩要求等)" style="width:100%; display:none;"></textarea>
                            <button id="sd-tpl-ai-run" class="sd-btn-primary" style="width:100%; margin-top:10px; display:none;">🚀 执行AI修改</button>
                        </div>
                    </div>
                </div>
                
                <!-- Tab 3: 前后缀 -->
                <div id="sd-tab-prefix" class="sd-tab-content">
                    <label style="display:block; margin-bottom:5px;">全局前缀</label>
                    <textarea id="sd-pre" class="text_pole" rows="4" style="width:100%">${settings.globalPrefix}</textarea>
                    
                    <label style="margin-top:15px; display:block; margin-bottom:5px;">全局后缀</label>
                    <textarea id="sd-suf" class="text_pole" rows="4" style="width:100%">${settings.globalSuffix}</textarea>
                    
                    <label style="margin-top:15px; display:block; margin-bottom:5px;">负面提示词</label>
                    <textarea id="sd-neg" class="text_pole" rows="5" style="width:100%">${settings.globalNegative}</textarea>
                </div>
                
                <!-- Tab 4: 独立生图 -->
                <div id="sd-tab-indep" class="sd-tab-content">
                    <div style="margin-bottom: 15px; padding: 12px; background: linear-gradient(145deg, #252530, #1e1e24); border-radius: 8px; box-shadow: 3px 3px 6px var(--nm-shadow-dark), -2px -2px 5px var(--nm-shadow-light);">
                        <label style="display:block; margin-bottom:8px; font-weight:600;">🔍 过滤标签（上下文过滤）</label>
                        <input type="text" id="sd-indep-filter-tags" class="text_pole" placeholder="如: <small>, [statbar], <div>（逗号分隔）" value="${settings.independentApiFilterTags || ''}" style="width:100%;">
                        <small style="color: #888; display: block; margin-top: 6px;">
                            提取上下文和当前楼层时，会移除这些标签包裹的内容。例如填入 <code>&lt;small&gt;</code> 会移除 <code>&lt;small&gt;...&lt;/small&gt;</code> 内的内容。
                        </small>
                    </div>
                    
                    <!-- 世界书选择器 -->
                    <div style="margin-bottom: 15px; padding: 12px; background: linear-gradient(145deg, #252530, #1e1e24); border-radius: 8px; box-shadow: 3px 3px 6px var(--nm-shadow-dark), -2px -2px 5px var(--nm-shadow-light);">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                            <label style="font-weight:600;">📚 世界书注入</label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="sd-worldbook-enabled" ${settings.worldbookEnabled ? 'checked' : ''}>
                                <span style="font-size: 0.9em;">启用</span>
                            </label>
                        </div>
                        <small style="color: #888; display: block; margin-bottom: 10px;">
                            选中的世界书条目会作为参考资料发送给AI，帮助其理解人物背景。配置按角色卡保存并随导出配置保留。
                        </small>
                        <button id="sd-worldbook-load" class="sd-btn-secondary" style="width:100%; margin-bottom:10px;">🔄 加载角色世界书</button>
                        <div id="sd-worldbook-list" style="max-height: 200px; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 5px; padding: 8px;">
                            <small style="color: #666;">点击"加载角色世界书"以显示可选条目</small>
                        </div>
                        <div style="margin-top: 8px; display: flex; gap: 8px;">
                            <button id="sd-worldbook-select-all" class="sd-btn-secondary" style="flex:1; font-size:0.85em;">全选</button>
                            <button id="sd-worldbook-deselect-all" class="sd-btn-secondary" style="flex:1; font-size:0.85em;">全不选</button>
                            <button id="sd-worldbook-save" class="sd-btn-primary" style="flex:1; font-size:0.85em;">💾 保存选择</button>
                        </div>
                    </div>
                    
                    <h4 style="margin-top:0; margin-bottom:10px;">上下文预览（最后一次分析）</h4>
                    <div id="sd-indep-preview" style="background: rgba(0,0,0,0.3); border-radius: 5px; padding: 10px; max-height: 250px; overflow-y: auto;">
                        <div style="margin-bottom: 10px;">
                            <strong style="color: var(--SmartThemeQuoteColor);">最新楼层消息（已编号）：</strong>
                            <pre id="sd-indep-latest" style="white-space: pre-wrap; font-size: 0.85em; color: #aaa; margin-top: 5px;">${independentApiLastPreview.latest || '暂无数据'}</pre>
                        </div>
                        <div>
                            <strong style="color: var(--SmartThemeQuoteColor);">历史上下文：</strong>
                            <div id="sd-indep-history-list" style="font-size: 0.85em; color: #aaa; margin-top: 5px;">
                                ${independentApiLastPreview.history.length > 0 
                                    ? independentApiLastPreview.history.map((h, i) => `<div style="margin-bottom:8px; padding:5px; background:rgba(0,0,0,0.2); border-radius:3px;"><span style="color:${h.role==='user'?'#6cf':'#fc6'}; font-weight:bold;">[${h.role}]</span><br/><span style="white-space:pre-wrap;">${h.content}</span></div>`).join('') 
                                    : '暂无数据'}
                            </div>
                        </div>
                    </div>
                    
                    <h4 style="margin-top:15px; margin-bottom:10px;">完整提示词预览</h4>
                    <button id="sd-indep-refresh-preview" class="sd-btn-secondary" style="width:100%; margin-bottom:10px;">🔄 刷新预览</button>
                    <div id="sd-indep-full-prompt" style="background: rgba(0,0,0,0.3); border-radius: 5px; padding: 10px; max-height: 300px; overflow-y: auto;">
                        <pre style="white-space: pre-wrap; font-size: 0.8em; color: #ccc; margin: 0;">点击上方"刷新预览"按钮查看完整提示词</pre>
                    </div>
                    
                    <button id="sd-indep-manual" class="sd-btn-secondary" style="width:100%; margin-top:15px;">🔄 手动触发独立生图</button>
                    <small style="color: #888; display: block; margin-top: 5px;">对最新一条AI消息手动执行独立生图流程</small>
                    
                    <h4 style="margin-top:20px; margin-bottom:10px;">
                        <span id="sd-indep-prompt-toggle" style="cursor:pointer; user-select:none;">▶ 自定义系统提示词</span>
                    </h4>
                    <div id="sd-indep-prompt-editor" style="display:none;">
                        <small style="color: #888; display: block; margin-bottom: 8px;">留空则使用默认系统提示词。自定义后会完全替换默认的通用规则部分。</small>
                        <textarea id="sd-indep-custom-prompt" class="text_pole" rows="12" style="width:100%; font-family:monospace; font-size:0.85em;">${settings.independentApiCustomPrompt || ''}</textarea>
                        <div style="display:flex; gap:10px; margin-top:10px;">
                            <button id="sd-indep-prompt-reset" class="sd-btn-secondary" style="flex:1;">恢复默认提示词</button>
                            <button id="sd-indep-prompt-save" class="sd-btn-primary" style="flex:1;">保存提示词</button>
                        </div>
                    </div>
                </div>
                
                <div class="sd-config-controls">
                    <button id="sd-export" class="sd-btn-secondary">📤 导出配置</button>
                    <button id="sd-import" class="sd-btn-secondary">📥 导入配置</button>
                    <button id="sd-reset-default" class="sd-btn-danger" style="flex:0.6;">🔄 恢复默认</button>
                </div>
                
                <button id="sd-save" class="sd-btn-primary" style="width: 100%; margin-top:10px;">💾 保存设置</button>
            </div>`;
            
        SillyTavern.callGenericPopup(html, 1, '', { wide: false });
        
        setTimeout(() => {
            // Tab切换
            $('.sd-tab-btn').on('click', function() {
                $('.sd-tab-btn, .sd-tab-content').removeClass('active');
                $(this).addClass('active');
                $(`#sd-tab-${$(this).data('tab')}`).addClass('active');
            });

            // 导出配置
            $('#sd-export').on('click', () => {
                exportConfig();
            });

            // 导入配置
            $('#sd-import').on('click', () => {
                importConfig();
            });

            // 恢复默认配置（需二次确认）
            $('#sd-reset-default').on('click', async () => {
                const confirmed = confirm('⚠️ 确定要恢复所有设置为默认值吗？\n\n此操作将清除所有自定义配置，包括API密钥、人物列表等，且不可撤销。');
                if (confirmed) {
                    settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
                    customTemplates = {};
                    saveSettings();
                    localStorage.removeItem(TEMPLATES_KEY);
                    toastr.success('✅ 已恢复默认配置，请重新打开设置面板');
                    closePopup();
                }
            });

            // ==================== 世界书选择器事件 ====================
            
            // 世界书启用开关
            $('#sd-worldbook-enabled').on('change', function() {
                settings.worldbookEnabled = $(this).is(':checked');
                saveSettings();
                addLog('WORLDBOOK', `世界书注入: ${settings.worldbookEnabled ? '已启用' : '已禁用'}`);
            });
            
            // 加载角色世界书
            $('#sd-worldbook-load').on('click', async () => {
                const $list = $('#sd-worldbook-list');
                $list.html('<small style="color: #6cf;">正在加载世界书...</small>');
                
                try {
                    const lorebooks = await getCharacterWorldbooks();
                    const bookNames = [];
                    if (lorebooks.primary) bookNames.push(lorebooks.primary);
                    if (lorebooks.additional?.length) bookNames.push(...lorebooks.additional);
                    
                    if (bookNames.length === 0) {
                        $list.html('<small style="color: #f66;">当前角色没有链接任何世界书</small>');
                        return;
                    }
                    
                    // 获取当前角色的已选择条目
                    const currentSelection = getCurrentCharacterWorldbookSelection();
                    
                    let html = '';
                    for (const bookName of bookNames) {
                        const entries = await getWorldbookEntries(bookName);
                        const selectedUids = currentSelection[bookName] || [];
                        
                        html += `<div style="margin-bottom: 10px;">
                            <div style="font-weight: 600; color: var(--nm-accent); margin-bottom: 5px; font-size: 0.9em;">📖 ${bookName}</div>`;
                        
                        if (entries.length === 0) {
                            html += '<small style="color: #888; margin-left: 10px;">（无条目）</small>';
                        } else {
                            for (const entry of entries) {
                                const entryName = entry.comment || entry.name || `条目 ${entry.uid}`;
                                const isSelected = selectedUids.includes(entry.uid);
                                const isEnabled = entry.enabled !== false;
                                
                                html += `<label style="display: flex; align-items: flex-start; gap: 6px; margin: 4px 0 4px 10px; cursor: pointer; opacity: ${isEnabled ? '1' : '0.5'};">
                                    <input type="checkbox" class="sd-worldbook-entry" data-book="${bookName}" data-uid="${entry.uid}" ${isSelected ? 'checked' : ''}>
                                    <span style="font-size: 0.85em; line-height: 1.3;">${entryName}${!isEnabled ? ' <span style="color:#f66;">(已禁用)</span>' : ''}</span>
                                </label>`;
                            }
                        }
                        html += '</div>';
                    }
                    
                    $list.html(html);
                    toastr.success(`✅ 已加载 ${bookNames.length} 个世界书`);
                    
                } catch (e) {
                    $list.html(`<small style="color: #f66;">加载失败: ${e.message}</small>`);
                    addLog('ERROR', `加载世界书失败: ${e.message}`);
                }
            });
            
            // 全选世界书条目
            $('#sd-worldbook-select-all').on('click', () => {
                $('#sd-worldbook-list input.sd-worldbook-entry').prop('checked', true);
            });
            
            // 取消全选
            $('#sd-worldbook-deselect-all').on('click', () => {
                $('#sd-worldbook-list input.sd-worldbook-entry').prop('checked', false);
            });
            
            // 保存世界书选择
            $('#sd-worldbook-save').on('click', () => {
                const selection = {};
                $('#sd-worldbook-list input.sd-worldbook-entry:checked').each(function() {
                    const bookName = $(this).data('book');
                    const uid = $(this).data('uid');
                    if (!selection[bookName]) selection[bookName] = [];
                    selection[bookName].push(uid);
                });
                
                saveCurrentCharacterWorldbookSelection(selection);
                const totalEntries = Object.values(selection).reduce((sum, arr) => sum + arr.length, 0);
                toastr.success(`✅ 已保存 ${totalEntries} 个世界书条目选择`);
            });

            // 系统提示词编辑器展开/收缩
            $('#sd-indep-prompt-toggle').on('click', function() {
                const $editor = $('#sd-indep-prompt-editor');
                const $toggle = $(this);
                if ($editor.is(':visible')) {
                    $editor.slideUp(200);
                    $toggle.text('▶ 自定义系统提示词');
                } else {
                    $editor.slideDown(200);
                    $toggle.text('▼ 自定义系统提示词');
                }
            });

            // 保存自定义系统提示词
            $('#sd-indep-prompt-save').on('click', () => {
                settings.independentApiCustomPrompt = $('#sd-indep-custom-prompt').val();
                saveSettings();
                toastr.success('✅ 系统提示词已保存');
            });

            // 恢复默认系统提示词
            $('#sd-indep-prompt-reset').on('click', () => {
                const defaultPrompt = buildIndependentApiGeneralRules();
                $('#sd-indep-custom-prompt').val(defaultPrompt);
                toastr.info('已填入默认系统提示词，点击"保存提示词"生效');
            });

            // 刷新完整提示词预览
            $('#sd-indep-refresh-preview').on('click', async () => {
                const chat = SillyTavern.chat;
                if (!chat || chat.length === 0) {
                    $('#sd-indep-full-prompt pre').text('当前没有聊天记录');
                    return;
                }
                
                // 找到最后一条AI消息
                let lastAiMesId = -1;
                for (let i = chat.length - 1; i >= 0; i--) {
                    if (!chat[i].is_user) {
                        lastAiMesId = i;
                        break;
                    }
                }
                
                if (lastAiMesId < 0) {
                    $('#sd-indep-full-prompt pre').text('未找到AI消息');
                    return;
                }
                
                const message = chat[lastAiMesId];
                const originalText = message.mes;
                
                // 提取段落
                const paragraphs = extractParagraphs(originalText);
                const formattedParagraphs = formatParagraphsForAI(paragraphs);
                
                // 提取历史上下文
                const historyCount = parseInt($('#sd-indep-history').val()) || 4;
                const historyContext = extractHistoryContext(lastAiMesId, historyCount);
                
                // 获取世界书内容（异步）
                let worldbookContent = '';
                try {
                    worldbookContent = await getSelectedWorldbookContent();
                } catch (e) {
                    addLog('WARN', `预览时获取世界书失败: ${e.message}`);
                }
                
                // 构建完整提示词（与实际API调用结构一致）
                const systemPrompt = buildIndependentApiSystemPrompt();
                
                let fullPrompt = '=== 系统提示词 ===\n' + systemPrompt + '\n\n';
                fullPrompt += '=== 用户消息（发送给AI的实际内容） ===\n\n';
                
                // 1. 世界书参考资料
                if (worldbookContent) {
                    fullPrompt += '【📚 世界书参考资料】（仅供理解人物背景，⚠️禁止在此处生成图片）\n';
                    fullPrompt += worldbookContent + '\n\n---\n\n';
                } else {
                    fullPrompt += '（未选择世界书条目或世界书功能已禁用）\n\n';
                }
                
                // 2. 历史上下文
                fullPrompt += '【📜 历史上下文】（仅供理解剧情发展，⚠️禁止在此处生成图片）\n';
                if (historyContext.length > 0) {
                    historyContext.forEach((h, i) => {
                        const roleLabel = h.role === 'user' ? '用户' : 'AI';
                        fullPrompt += `[${roleLabel}] ${h.content}\n\n`;
                    });
                } else {
                    fullPrompt += '（无历史上下文）\n\n';
                }
                fullPrompt += '---\n\n';
                
                // 3. 最新剧情（核心任务）
                fullPrompt += '【🎯 最新剧情】（⚠️只能为这部分内容生成图片！after_paragraph的数字对应下方段落编号）\n';
                fullPrompt += formattedParagraphs || '（未找到有效段落）';
                
                // 更新预览
                $('#sd-indep-full-prompt pre').text(fullPrompt);
                
                // 同时更新其他预览区域
                $('#sd-indep-latest').text(formattedParagraphs || '暂无数据');
                $('#sd-indep-history-list').html(
                    historyContext.length > 0 
                        ? historyContext.map(h => `<div style="margin-bottom:8px; padding:5px; background:rgba(0,0,0,0.2); border-radius:3px;"><span style="color:${h.role==='user'?'#6cf':'#fc6'}; font-weight:bold;">[${h.role}]</span><br/><span style="white-space:pre-wrap;">${h.content}</span></div>`).join('') 
                        : '暂无数据'
                );
                
                // 保存到预览变量
                independentApiLastPreview = {
                    latest: formattedParagraphs,
                    history: historyContext
                };
                
                const wbStatus = worldbookContent ? `（含${worldbookContent.split('【').length - 1}个世界书条目）` : '';
                toastr.success(`预览已刷新${wbStatus}`, null, { timeOut: 2000 });
            });

            // 手动触发独立API生图
            $('#sd-indep-manual').on('click', async () => {
                const chat = SillyTavern.chat;
                if (!chat || chat.length === 0) {
                    toastr.warning('当前没有聊天记录');
                    return;
                }
                
                // 找到最后一条AI消息
                let lastAiMesId = -1;
                for (let i = chat.length - 1; i >= 0; i--) {
                    if (!chat[i].is_user) {
                        lastAiMesId = i;
                        break;
                    }
                }
                
                if (lastAiMesId < 0) {
                    toastr.warning('未找到AI消息');
                    return;
                }
                
                closePopup();
                setTimeout(() => {
                    handleIndependentApiGeneration(lastAiMesId);
                }, 200);
            });

            // 人物列表事件
            $('#sd-char-list').on('click', '.sd-char-del', function() {
                $(this).closest('.sd-char-row').remove();
            });

            $('#sd-add-char').on('click', function() {
                const currentCount = $('#sd-char-list .sd-char-row').length;
                const newRow = `
                    <div class="sd-char-row" data-idx="${currentCount}">
                        <input type="checkbox" class="sd-char-checkbox" checked />
                        <input type="text" class="sd-char-name text_pole" placeholder="人物名称" value="新人物${currentCount + 1}" />
                        <input type="text" class="sd-char-tags text_pole" placeholder="固定特征词" value="" />
                        <button class="sd-char-del">删除</button>
                    </div>`;
                $('#sd-char-list').append(newRow);
            });

            // 模版选择变化时更新编辑器和按钮状态
            $('#sd-template-select').on('change', function() {
                const selectedTpl = $(this).val();
                const templates = getAllTemplates();
                const content = templates[selectedTpl] || '';
                const isDefault = DEFAULT_TEMPLATES.hasOwnProperty(selectedTpl);
                
                $('#sd-tpl-name-edit').val(selectedTpl);
                $('#sd-tpl-content-edit').val(content);
                $('#sd-tpl-replace').prop('disabled', isDefault);
                
                if ($('#sd-template-editor').hasClass('show')) {
                    if (isDefault) {
                        toastr.info('系统默认模版只能另存，不能替换');
                    }
                }
            });

            // 修改模版按钮
            $('#sd-tpl-edit').on('click', function() {
                $('#sd-template-editor').toggleClass('show');
            });

            // AI修改按钮
            $('#sd-tpl-ai-btn').on('click', function() {
                $('#sd-tpl-ai-instruction').toggle();
                $('#sd-tpl-ai-run').toggle();
            });

            // 执行AI修改
            $('#sd-tpl-ai-run').on('click', async function() {
                const instruction = $('#sd-tpl-ai-instruction').val().trim();
                if (!instruction) {
                    toastr.warning('请输入修改要求');
                    return;
                }
                
                const currentContent = $('#sd-tpl-content-edit').val();
                const $btn = $(this);
                $btn.prop('disabled', true).text('⏳ AI处理中...');
                
                try {
                    const modifiedContent = await callLLMForTemplateUpdate(currentContent, instruction);
                    $('#sd-tpl-content-edit').val(modifiedContent);
                    toastr.success('✅ AI模版修改完成！请检查后保存');
                } catch (e) {
                    toastr.error(`❌ AI修改失败: ${e.message}`);
                } finally {
                    $btn.prop('disabled', false).text('🚀 执行AI修改');
                }
            });

            // 替换模版
            $('#sd-tpl-replace').on('click', function() {
                const selectedTpl = $('#sd-template-select').val();
                const newName = $('#sd-tpl-name-edit').val().trim();
                const newContent = $('#sd-tpl-content-edit').val().trim();
                
                if (!newName) {
                    toastr.warning('请输入模版名称');
                    return;
                }
                if (!newContent) {
                    toastr.warning('请输入模版内容');
                    return;
                }
                
                const isDefault = DEFAULT_TEMPLATES.hasOwnProperty(selectedTpl);
                if (isDefault) {
                    toastr.error('不能替换系统默认模版，请使用"另存"');
                    return;
                }
                
                if (!confirm(`确定要替换模版 "${selectedTpl}" 吗？`)) return;
                
                if (newName !== selectedTpl && customTemplates.hasOwnProperty(selectedTpl)) {
                    delete customTemplates[selectedTpl];
                }
                
                customTemplates[newName] = newContent;
                saveTemplates();
                settings.selectedTemplate = newName;
                saveSettings();
                
                toastr.success('✅ 模版已替换');
                closePopup();
                setTimeout(() => openSettingsPopup(), 200);
            });

            // 另存模版
            $('#sd-tpl-saveas').on('click', function() {
                const newName = $('#sd-tpl-name-edit').val().trim();
                const newContent = $('#sd-tpl-content-edit').val().trim();
                
                if (!newName) {
                    toastr.warning('请输入模版名称');
                    return;
                }
                if (!newContent) {
                    toastr.warning('请输入模版内容');
                    return;
                }
                
                if (DEFAULT_TEMPLATES.hasOwnProperty(newName)) {
                    toastr.error('不能使用系统默认模版名称');
                    return;
                }
                
                if (customTemplates.hasOwnProperty(newName)) {
                    if (!confirm(`模版 "${newName}" 已存在，确定要覆盖吗？`)) return;
                }
                
                customTemplates[newName] = newContent;
                saveTemplates();
                settings.selectedTemplate = newName;
                saveSettings();
                
                toastr.success(`✅ 模版已另存为 "${newName}"`);
                closePopup();
                setTimeout(() => openSettingsPopup(), 200);
            });

            // 删除模版
            $('#sd-tpl-del').on('click', function() {
                const selected = $('#sd-template-select').val();
                if (DEFAULT_TEMPLATES.hasOwnProperty(selected)) {
                    toastr.error('不能删除系统默认模版');
                    return;
                }
                if (!confirm(`确定删除模版 "${selected}" 吗？`)) return;
                
                delete customTemplates[selected];
                saveTemplates();
                
                settings.selectedTemplate = "默认模版";
                saveSettings();
                toastr.success('✅ 模版已删除');
                closePopup();
                setTimeout(() => openSettingsPopup(), 200);
            });

            // API参数实时显示
            $('#sd-temp').on('input', function() {
                $('#sd-temp-val').text($(this).val());
            });
            $('#sd-top-p').on('input', function() {
                $('#sd-top-p-val').text($(this).val());
            });
            $('#sd-freq-pen').on('input', function() {
                $('#sd-freq-pen-val').text($(this).val());
            });
            $('#sd-pres-pen').on('input', function() {
                $('#sd-pres-pen-val').text($(this).val());
            });

            // 获取模型列表
            $('#sd-fetch-models').on('click', async function() {
                const $btn = $(this);
                const url = $('#sd-url').val();
                const key = $('#sd-key').val();
                
                if (!url) {
                    toastr.warning('请先填写 Base URL');
                    return;
                }
                
                $btn.prop('disabled', true).text('获取中...');
                
                try {
                    const models = await fetchModels(url, key);
                    const $select = $('#sd-model-select');
                    $select.empty();
                    
                    if (models.length === 0) {
                        toastr.warning('未获取到模型列表');
                        $select.append(`<option value="${settings.llmConfig.model}">${settings.llmConfig.model}</option>`);
                    } else {
                        models.forEach(m => {
                            $select.append(`<option value="${m}" ${m === settings.llmConfig.model ? 'selected' : ''}>${m}</option>`);
                        });
                        toastr.success(`✅ 成功获取 ${models.length} 个模型`);
                    }
                } catch (e) {
                    toastr.error(`❌ 获取模型失败: ${e.message}`);
                    $('#sd-model-select').append(`<option value="${settings.llmConfig.model}">${settings.llmConfig.model}</option>`);
                } finally {
                    $btn.prop('disabled', false).text('获取模型');
                }
            });

            // 测试API
            $('#sd-test-api').on('click', async function() {
                const $btn = $(this);
                const url = $('#sd-url').val();
                const key = $('#sd-key').val();
                const model = $('#sd-model-select').val();
                
                if (!url || !key) {
                    toastr.warning('请先填写 Base URL 和 API Key');
                    return;
                }
                
                $btn.prop('disabled', true).text('⏳ 测试中...');
                
                try {
                    const testConfig = {
                        baseUrl: url,
                        apiKey: key,
                        model: model,
                        maxTokens: 50,
                        temperature: 0.7,
                        topP: 1.0,
                        frequencyPenalty: 0.0,
                        presencePenalty: 0.0
                    };
                    
                    const oldConfig = settings.llmConfig;
                    settings.llmConfig = testConfig;
                    
                    await callLLMForUpdate('1girl, long hair, blue dress', 'make it shorter');
                    
                    settings.llmConfig = oldConfig;
                    
                    toastr.success('✅ API连接测试成功！');
                } catch (e) {
                    toastr.error(`❌ API测试失败: ${e.message}`);
                } finally {
                    $btn.prop('disabled', false).text('🧪 测试API连接');
                }
            });

            // 保存设置
            $('#sd-save').on('click', () => {
                settings.injectEnabled = $('#sd-inj-en').is(':checked');
                settings.injectDepth = parseInt($('#sd-inj-depth').val()) || 0;
                settings.injectRole = $('#sd-inj-role').val();
                settings.selectedTemplate = $('#sd-template-select').val();
                
                const newCharacters = [];
                $('#sd-char-list .sd-char-row').each(function() {
                    const $row = $(this);
                    const char = {
                        name: $row.find('.sd-char-name').val().trim(),
                        tags: $row.find('.sd-char-tags').val().trim(),
                        enabled: $row.find('.sd-char-checkbox').is(':checked')
                    };
                    if (char.name) newCharacters.push(char);
                });
                
                settings.characters = newCharacters;
                settings.enabled = $('#sd-en').is(':checked');
                settings.globalPrefix = $('#sd-pre').val();
                settings.globalSuffix = $('#sd-suf').val();
                settings.globalNegative = $('#sd-neg').val();
                settings.autoRefresh = $('#sd-auto-refresh').prop('checked'); //读取自动刷新配置
                settings.autoRefreshInterval = parseInt($('#sd-auto-refresh-interval').val()) * 1000;
                
                // 超时设置
                settings.timeoutEnabled = $('#sd-timeout-en').is(':checked');
                settings.timeoutSeconds = parseInt($('#sd-timeout-seconds').val()) || 120;
                
                // 独立API模式设置
                settings.independentApiEnabled = $('#sd-indep-en').is(':checked');
                settings.independentApiHistoryCount = parseInt($('#sd-indep-history').val()) || 4;
                settings.independentApiDebounceMs = parseInt($('#sd-indep-debounce').val()) || 1000;
                settings.independentApiFilterTags = $('#sd-indep-filter-tags').val() || '';
                
                settings.llmConfig.baseUrl = $('#sd-url').val();
                settings.llmConfig.apiKey = $('#sd-key').val();
                settings.llmConfig.model = $('#sd-model-select').val();
                settings.llmConfig.maxTokens = parseInt($('#sd-max-tokens').val()) || 4096;
                settings.llmConfig.temperature = parseFloat($('#sd-temp').val()) || 0.7;
                settings.llmConfig.topP = parseFloat($('#sd-top-p').val()) || 1.0;
                settings.llmConfig.frequencyPenalty = parseFloat($('#sd-freq-pen').val()) || 0.0;
                settings.llmConfig.presencePenalty = parseFloat($('#sd-pres-pen').val()) || 0.0;
                
                toggleAutoRefresh(); //应用定时器设置

                saveSettings();
                toastr.success('✅ 设置已保存');
                closePopup();
                processChatDOM();
            });
        }, 100);
    }

    async function triggerSlash(cmd) {
        const trigger = (window.triggerSlash || window.parent?.triggerSlash);
        if (!trigger) throw new Error('API不可用');
        return await trigger.call(window.parent || window, cmd);
    }

    function handleContextInjection(data) {
        // 独立API模式下跳过注入
        if (settings.independentApiEnabled) {
            addLog('INJECT', '独立API模式已启用，跳过注入');
            return;
        }
        
        if (!settings.enabled || !settings.injectEnabled) return;
        
        const injectPrompt = getInjectPrompt();
        if (!injectPrompt) return;
        
        let chat = Array.isArray(data) ? data : (data?.chat || []);
        if (chat.some(m => (m.content === injectPrompt || m.mes === injectPrompt))) return;
        
        chat.splice(Math.max(0, chat.length - settings.injectDepth), 0, { 
            role: settings.injectRole || 'system', 
            content: injectPrompt 
        });
    }

function registerSTEvents() {
    // 1. 注入上下文：仍然监听 CHAT_COMPLETION_PROMPT_READY
    if (typeof eventOn !== 'function' || typeof tavern_events === 'undefined') return;

    eventOn(tavern_events.CHAT_COMPLETION_PROMPT_READY, handleContextInjection);

    // 2. 这些事件发生时，统一触发一次 processChatDOM（带防抖）
    const eventsToWatch = [
        tavern_events.MESSAGE_SWIPED,         // 'message_swiped'
        tavern_events.MESSAGE_RECEIVED,       // 'message_received'
        tavern_events.MESSAGE_DELETED,        // 'message_deleted'
        tavern_events.MESSAGE_UPDATED,        // 'message_updated'
        tavern_events.MESSAGE_SWIPE_DELETED,  // 'message_swipe_deleted'
        tavern_events.MORE_MESSAGES_LOADED,   // 'more_messages_loaded'
        tavern_events.CHAT_CHANGED,           // 'chat_id_changed'
        tavern_events.CHARACTER_MESSAGE_RENDERED,
        tavern_events.WORLDINFO_UPDATED,
    ];

    const handler = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(processChatDOM, 500);
    };

    for (const ev of eventsToWatch) {
        eventOn(ev, handler);
    }
    
    // 3. 独立API模式：单独监听 MESSAGE_RECEIVED 事件
    eventOn(tavern_events.MESSAGE_RECEIVED, (mesId) => {
        if (settings.independentApiEnabled && settings.enabled) {
            // 防抖处理
            clearTimeout(independentApiDebounceTimer);
            independentApiDebounceTimer = setTimeout(() => {
                addLog('EVENT', `MESSAGE_RECEIVED 触发，消息ID: ${mesId}`);
                handleIndependentApiGeneration(mesId);
            }, settings.independentApiDebounceMs);
        }
    });
    
    eventOn(tavern_events.GENERATION_STARTED, () => {
        if (settings.autoRefresh && settings.enabled && !autoRefreshPaused) {
            toggleAutoRefresh(true);  // 暂停
            addLog('EVENT', '检测到生成开始，暂停自动刷新');
            if (typeof toastr !== 'undefined') {
                toastr.info('⏸️ 生成中，已暂停自动刷新', null, { timeOut: 1500 });
            }
        }
    });

    eventOn(tavern_events.GENERATION_ENDED, () => {
        if (settings.autoRefresh && settings.enabled && autoRefreshPaused) {
            setTimeout(() => {
                toggleAutoRefresh(false);  // 恢复
                addLog('EVENT', '检测到生成结束，恢复自动刷新');
                if (typeof toastr !== 'undefined') {
                    toastr.success('▶️ 生成完成，已恢复自动刷新', null, { timeOut: 1500 });
                }
            }, 500);  // 延迟500ms，确保生成完全结束
        }
    });
}

// --- 工具栏「修复」按钮：手动触发一次 processChatDOM ---
if (typeof appendInexistentScriptButtons === 'function' && typeof getButtonEvent === 'function' && typeof eventOn === 'function') {
    // 1. 添加按钮
    appendInexistentScriptButtons([
        { name: 'SD修复', visible: true },
        { name: '手动生词', visible: true },
    ]);

    // 2. 绑定SD修复按钮事件：点击后立即执行一次 processChatDOM
    eventOn(getButtonEvent('SD修复'), () => {
        try {
            processChatDOM();
            if (typeof toastr !== 'undefined') {
                toastr.success('✅ 已执行修复：重新扫描并挂载生图UI');
            }
        } catch (e) {
            console.error('[生图助手] 修复时出错：', e);
            if (typeof toastr !== 'undefined') {
                toastr.error('❌ 修复失败，请查看控制台');
            }
        }
    });
    
    // 3. 绑定手动生词按钮事件：清除最新楼层的IMG_GEN标签，然后重新执行独立API生图
    eventOn(getButtonEvent('手动生词'), async () => {
        try {
            const chat = SillyTavern.chat;
            if (!chat || chat.length === 0) {
                toastr.warning('⚠️ 没有找到聊天记录');
                return;
            }
            
            // 找到最新的AI消息
            let latestAiMesId = -1;
            for (let i = chat.length - 1; i >= 0; i--) {
                if (!chat[i].is_user) {
                    latestAiMesId = i;
                    break;
                }
            }
            
            if (latestAiMesId < 0) {
                toastr.warning('⚠️ 没有找到AI消息');
                return;
            }
            
            const message = chat[latestAiMesId];
            const originalText = message.mes;
            
            // 清除 [IMG_GEN]...[/IMG_GEN] 标签及其内容
            const startTag = settings.startTag || '[IMG_GEN]';
            const endTag = settings.endTag || '[/IMG_GEN]';
            // 转义正则特殊字符
            const escapeRe = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(
                escapeRe(startTag) + '[\\s\\S]*?' + escapeRe(endTag),
                'gi'
            );
            const cleanedText = originalText.replace(regex, '').replace(/\n{3,}/g, '\n\n').trim();
            
            if (cleanedText === originalText) {
                toastr.info('ℹ️ 消息中没有IMG_GEN标签，直接执行生词');
            } else {
                // 更新消息内容
                message.mes = cleanedText;
                
                // 保存到聊天
                try {
                    await SillyTavern.context.saveChat();
                    await SillyTavern.eventSource.emit('message_updated', latestAiMesId);
                    addLog('MANUAL', `已清除消息${latestAiMesId}的IMG_GEN标签`);
                    toastr.info('🧹 已清除IMG_GEN标签');
                } catch (e) {
                    addLog('WARN', `保存失败: ${e.message}`);
                }
            }
            
            // 刷新UI
            processChatDOM();
            
            // 延迟后执行独立API生图
            setTimeout(() => {
                if (settings.independentApiEnabled && settings.enabled) {
                    handleIndependentApiGeneration(latestAiMesId);
                } else {
                    toastr.warning('⚠️ 请先在设置中启用"独立生图模式"');
                }
            }, 500);
            
        } catch (e) {
            console.error('[生图助手] 手动生词时出错：', e);
            if (typeof toastr !== 'undefined') {
                toastr.error('❌ 手动生词失败，请查看控制台');
            }
        }
    });
}

})();
