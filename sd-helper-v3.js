// ==UserScript==
// @name         生图助手 (Fix v40 - Export/Import)
// @version      v40.0
// @description  添加AI修改模版功能
// @author       Walkeatround & Gemini & AI Assistant
// @match        */*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

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
        "默认模版": `You are a Visual Novel Engine. Generate story with image prompts in [IMG_GEN]...[/IMG_GEN] tags.

        ## Character Database (Fixed Tags - MUST Copy Verbatim):
        <!--人物列表-->
            
        ## Core Rules:
        1. Insert image prompts every 150-200 words at scene shifts
        2. ONE character per prompt (NO '2girls', '1boy' forbidden)
        3. Fixed tags MUST be copied exactly - treat as immutable code
        4. For interactions: generate separate prompts from each perspective
        5. Tags format: '1girl, [FIXED_TAGS], [expression], [attire], [pose], [action], [focus], [viewpoint], [environment], [lighting], [quality]'
            
        ## Attire Requirements:
        - Describe: upper body + lower body + feet
        - Missing parts: use 'topless', 'bottomless', 'barefoot', 'naked'
            
        Quality suffix: 'highly detailed, masterpiece, best quality'`
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
            { name: 'Character 1', tags: 'short black hair, red eyes, black dress', enabled: false }
        ],
        llmConfig: { 
            baseUrl: 'https://api.deepseek.com', 
            apiKey: '', 
            model: 'deepseek-chat', 
            maxTokens: 8192, 
            temperature: 0.7,
            topP: 1.0,
            presencePenalty: 0.0,
            frequencyPenalty: 0.0
        },
        autoRefresh: false,  // 自动刷新开关
        autoRefreshInterval: 3000 // 刷新间隔（毫秒）
    };

    let settings = DEFAULT_SETTINGS;
    let customTemplates = {};
    let debounceTimer = null;
    let autoRefreshTimer = null;  // ✅ 定时器变量
    let autoRefreshPaused = false;  // ✅ 新增：记录是否因生成而暂停

    // --- CSS ---
    const GLOBAL_CSS = `
    .sd-ui-container * { box-sizing: border-box; user-select: none; }
    .sd-ui-wrap { display: flex; flex-direction: column; background: transparent; border: none; margin: 5px 0; width: 100%; position: relative; transition: all 0.3s ease; }
    .sd-ui-toggle { text-align: center; cursor: pointer; font-size: 0.8em; opacity: 0.2; color: var(--SmartThemeBodyColor, #ccc); margin-bottom: 2px; transition: opacity 0.2s; line-height: 1; }
    .sd-ui-toggle:hover { opacity: 1; color: var(--SmartThemeQuoteColor, #00afff); }
    .sd-ui-viewport { position: relative; width: 100%; min-height: 50px; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; overflow: hidden; }
    .sd-ui-viewport.collapsed { display: none; }
    .sd-ui-image { max-width: 100%; max-height: 600px; width: auto; height: auto; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: opacity 0.2s; z-index: 1; }
    .sd-zone { position: absolute; background: transparent; }
    .sd-zone.delete { bottom: 0; left: 0; width: 40%; height: 5%; z-index: 100; cursor: no-drop; }
    .sd-zone.left { top: 0; left: 0; width: 20%; height: 90%; z-index: 90; cursor: w-resize; }
    .sd-zone.right { top: 0; right: 0; width: 20%; height: 90%; z-index: 90; cursor: e-resize; }
    .sd-zone.right.gen-mode { cursor: alias; }
    .sd-zone.top { top: 0; left: 0; width: 100%; height: 20%; z-index: 80; cursor: text; }
    .sd-ui-msg { position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.6); color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 11px; pointer-events: none; opacity: 0; transition: opacity 0.3s; z-index: 15; white-space: nowrap; }
    .sd-ui-msg.show { opacity: 1; }
    .sd-placeholder { padding: 20px; border: 1px dashed rgba(255,255,255,0.1); border-radius: 6px; color: #aaa; font-size: 0.9em; text-align: center; width: 100%; opacity: 0.5; }
    .sd-tab-nav { display: flex; border-bottom: 1px solid var(--SmartThemeBorderColor, #555); margin-bottom: 15px; }
    .sd-tab-btn { padding: 8px 16px; cursor: pointer; opacity: 0.6; border-bottom: 2px solid transparent; font-weight: bold; transition: all 0.2s; }
    .sd-tab-btn:hover { opacity: 0.8; background: rgba(255,255,255,0.05); }
    .sd-tab-btn.active { opacity: 1; border-bottom-color: var(--SmartThemeQuoteColor, #00afff); color: var(--SmartThemeQuoteColor, #00afff); }
    .sd-tab-content { display: none; animation: sd-fade 0.2s; }
    .sd-tab-content.active { display: block; }
    @keyframes sd-fade { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
    .sd-char-row { display: flex; gap: 5px; margin-bottom: 8px; align-items: center; }
    .sd-char-checkbox { flex: 0 0 20px; }
    .sd-char-name { flex: 0 0 25%; }
    .sd-char-tags { flex: 1; font-family: monospace; font-size: 0.9em; }
    .sd-char-del { flex: 0 0 50px; background: rgba(200,50,50,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; height: 38px; border-radius: 3px; font-size: 0.85em; transition: all 0.2s; }
    .sd-char-del:hover { background: rgba(200,50,50,0.6); }
    .sd-add-btn { width: 100%; padding: 8px; background: rgba(255,255,255,0.1); border: 1px dashed #777; color: #ccc; cursor: pointer; margin-bottom: 15px; border-radius: 3px; transition: all 0.2s; }
    .sd-add-btn:hover { background: rgba(255,255,255,0.15); }
    .sd-char-list-container { max-height: 300px; overflow-y: auto; margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 5px; }
    .sd-template-section { margin-top: 15px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 5px; }
    .sd-template-section label { display: block; margin-bottom: 5px; font-weight: bold; }
    .sd-template-controls { display: flex; gap: 5px; margin-top: 10px; }
    .sd-template-controls button { flex: 1; padding: 6px; font-size: 0.85em; }
    .sd-template-editor { display: none; margin-top: 15px; padding: 15px; background: rgba(100,50,200,0.1); border-radius: 5px; border-left: 3px solid var(--SmartThemeQuoteColor); animation: sd-fade 0.3s; }
    .sd-template-editor.show { display: block; }
    .sd-template-title-row { display: flex; gap: 10px; margin-bottom: 10px; align-items: center; }
    .sd-template-title-row input { flex: 1; }
    .sd-template-title-row button { flex: 0 0 80px; }
    .sd-api-row { display: flex; gap: 10px; margin-bottom: 10px; align-items: center; }
    .sd-api-row label { flex: 0 0 120px; font-weight: bold; }
    .sd-api-row input, .sd-api-row select { flex: 1; }
    .sd-api-row .sd-range-value { flex: 0 0 50px; text-align: center; font-family: monospace; }
    .sd-inject-row { display: flex; gap: 10px; margin-bottom: 10px; align-items: center; }
    .sd-inject-row label { flex: 0 0 100px; font-weight: bold; }
    .sd-inject-row input, .sd-inject-row select { flex: 1; }
    .sd-btn-primary { background: var(--SmartThemeQuoteColor, #00afff); color: #fff; border: none; padding: 8px 16px; border-radius: 3px; cursor: pointer; transition: all 0.2s; }
    .sd-btn-primary:hover { opacity: 0.8; }
    .sd-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .sd-btn-secondary { background: rgba(255,255,255,0.1); color: #ccc; border: 1px solid rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 3px; cursor: pointer; transition: all 0.2s; }
    .sd-btn-secondary:hover { background: rgba(255,255,255,0.15); }
    .sd-btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
    .sd-btn-danger { background: rgba(200,50,50,0.3); color: #fff; border: 1px solid rgba(255,100,100,0.3); padding: 8px 16px; border-radius: 3px; cursor: pointer; transition: all 0.2s; }
    .sd-btn-danger:hover { background: rgba(200,50,50,0.6); }
    .sd-ai-update-box { margin-bottom: 10px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 5px; display: none; border-left: 2px solid var(--SmartThemeQuoteColor); }
    .sd-ai-update-box.show { display: block; animation: sd-fade 0.2s; }
    .sd-config-controls { display: flex; gap: 10px; margin-top: 10px; }
    .sd-config-controls button { flex: 1; }
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
        const config = {
            version: '40.0',
            exportDate: new Date().toISOString(),
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
            
            const res = await fetch(url, { method: 'GET', headers });
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
            const res = await fetch(url, {
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
            
            const content = data.choices?.[0]?.message?.content?.trim();
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
            const res = await fetch(url, {
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
            
            const content = data.choices?.[0]?.message?.content?.trim();
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

    // --- Template Management ---
    function loadTemplates() {
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

        try {
            const result = await triggerSlash(cmd);
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
            state.el.msg.text('❌ 错误'); 
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
                    return createUIHtml(p.prompt, p.images, p.preventAuto, blockIdx++, Math.max(0, p.images.length - 1));
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
    if (matches[bIdx][1].includes(SCHEDULED_FLAG) || matches[bIdx][1].includes(NO_GEN_FLAG)) {
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

    function createUIHtml(prompt, images, prevent, blockIdx, initIdx) {
        const has = images.length > 0;
        return `
        <div class="sd-ui-container">
            <div class="sd-ui-wrap" data-prompt="${encodeURIComponent(prompt)}" data-images="${encodeURIComponent(JSON.stringify(images))}" data-prevent-auto="${prevent}" data-block-idx="${blockIdx}" data-cur-idx="${initIdx}">
                <div class="sd-ui-toggle">▵</div>
                <div class="sd-ui-viewport">
                    <div class="sd-zone top" title="编辑"></div>
                    <div class="sd-zone left" style="display:${initIdx > 0 ? 'block' : 'none'}"></div>
                    <div class="sd-zone right ${!has || initIdx === images.length-1 ? 'gen-mode' : ''}"></div>
                    <div class="sd-zone delete" style="display:${has ? 'block' : 'none'}"></div>
                    <div class="sd-ui-msg ${has ? 'show' : ''}">${has ? `${initIdx+1}/${images.length}` : ''}</div>
                    <img class="sd-ui-image" src="${has ? images[initIdx] : ''}" style="display:${has ? 'block' : 'none'}" />
                    <div class="sd-placeholder" style="display:${has ? 'none' : 'block'}"><i class="fa-solid fa-image"></i> 等待生成...</div>
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
            <div style="padding: 10px; max-height: 70vh; overflow-y: auto;">
                <div class="sd-tab-nav">
                    <div class="sd-tab-btn active" data-tab="inj">注入</div>
                    <div class="sd-tab-btn" data-tab="prefix">前缀</div>
                    <div class="sd-tab-btn" data-tab="api">API</div>
                </div>
                
                <div id="sd-tab-inj" class="sd-tab-content active">
<div style="margin-bottom: 10px;">
    <label style="display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" id="sd-inj-en" ${settings.injectEnabled?'checked':''}>
        <span style="font-weight: bold;">启用注入</span>
    </label>
    <small style="color: #888; display: block; margin-left: 24px; margin-top: 4px;">
        向AI发送请求前，自动注入提示词模版和人物特征库
    </small>
</div>                    
                    <div style="margin-top:15px; margin-bottom:15px;">
                        <div class="sd-inject-row">
                            <label>注入深度</label>
                            <input type="number" id="sd-inj-depth" class="text_pole" value="${settings.injectDepth}" min="0" max="20" style="width:80px;">
                            <small style="color:#888;">0=最后, 1=倒数第二, 以此类推</small>
                        </div>
                        <div class="sd-inject-row">
                            <label>发送角色</label>
                            <select id="sd-inj-role" class="text_pole">
                                <option value="system" ${settings.injectRole === 'system' ? 'selected' : ''}>System</option>
                                <option value="user" ${settings.injectRole === 'user' ? 'selected' : ''}>User</option>
                                <option value="assistant" ${settings.injectRole === 'assistant' ? 'selected' : ''}>Assistant</option>
                            </select>
                        </div>
                    </div>
                    
                    <h4 style="margin-top:15px; margin-bottom:10px;">人物列表</h4>
                    <div class="sd-char-list-container" id="sd-char-list">
                        ${renderCharacterList()}
                    </div>
                    
                    <button class="sd-add-btn" id="sd-add-char">+ 添加新人物</button>
                    
                    <div class="sd-template-section">
                        <label>提示词模版</label>
                        <select id="sd-template-select" class="text_pole" style="width:100%; margin-bottom:10px;">
                            ${templateOptions}
                        </select>
                        <div class="sd-template-controls">
                            <button id="sd-tpl-edit" class="sd-btn-secondary">✏️ 修改模版</button>
                            <button id="sd-tpl-del" class="sd-btn-danger">🗑️ 删除模版</button>
                        </div>
                        <div style="font-size:0.85em; color:#888; margin-top:8px;">
                            <i class="fa-solid fa-info-circle"></i> 模版中的 <!--人物列表--> 将自动替换为上方启用的人物
                        </div>
                        
                        <div id="sd-template-editor" class="sd-template-editor">
                            <h4 style="margin-top:0; margin-bottom:10px;">编辑模版</h4>
                            <div class="sd-template-title-row">
                                <input type="text" id="sd-tpl-name-edit" class="text_pole" placeholder="模版名称" value="${selectedTemplate}">
                                <button id="sd-tpl-replace" class="sd-btn-primary" ${isDefaultTemplate ? 'disabled' : ''}>替换</button>
                                <button id="sd-tpl-saveas" class="sd-btn-secondary">另存</button>
                            </div>
                            ${isDefaultTemplate ? '<small style="color:#888; display:block; margin-bottom:10px;">* 系统默认模版只能另存，不能替换</small>' : ''}
                            <textarea id="sd-tpl-content-edit" class="text_pole" rows="12" style="width:100%; font-family:monospace; font-size:0.9em; margin-bottom:10px;">${selectedTemplateContent}</textarea>
                            <button id="sd-tpl-ai-btn" class="sd-btn-secondary" style="width:100%; margin-bottom:10px;">🤖 使用AI修改</button>
                            <textarea id="sd-tpl-ai-instruction" class="text_pole" rows="3" placeholder="告诉AI如何修改模版 (如: 增加更详细的attire说明, 添加色彩要求等)" style="width:100%; display:none;"></textarea>
                            <button id="sd-tpl-ai-run" class="sd-btn-primary" style="width:100%; margin-top:10px; display:none;">🚀 执行AI修改</button>
                        </div>
                    </div>
                </div>
                
                <div id="sd-tab-prefix" class="sd-tab-content">
                <div style="margin-bottom: 10px;">
                    <label style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="sd-en" ${settings.enabled?'checked':''}>
                        <span style="font-weight: bold;">启用解析生图</span>
                    </label>
                    <small style="color: #888; display: block; margin-left: 24px; margin-top: 4px;">
                        自动识别 [IMG_GEN]...[/IMG_GEN] 标签并生成图片UI框
                    </small>
                </div>
                    <label style="margin-top:10px; display:block;">全局前缀</label>
                    <textarea id="sd-pre" class="text_pole" rows="2" style="width:100%">${settings.globalPrefix}</textarea>
                    <label style="margin-top:10px; display:block;">全局后缀</label>
                    <textarea id="sd-suf" class="text_pole" rows="2" style="width:100%">${settings.globalSuffix}</textarea>
                    <label style="margin-top:10px; display:block;">负面提示词</label>
                    <textarea id="sd-neg" class="text_pole" rows="3" style="width:100%">${settings.globalNegative}</textarea>
                </div>
                <label style="margin-top:10px; display:block;">自动修复</label>
                <div style="margin-bottom: 15px; padding: 10px; background: #171717; border-radius: 5px;">
                    <label style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="sd-auto-refresh" ${settings.autoRefresh?'checked':''}>
                        <span style="font-weight: bold;">自动修复UI</span>
                    </label>
                    <small style="color: #888; display: block; margin-left: 24px; margin-top: 4px;">
                        ⚠️ 自动扫描并修复UI（可能引起问题，无必要不开）
                    </small>
                    <div style="margin-left: 24px; margin-top: 8px;">
                        <label style="font-size: 12px;">
                            修复间隔（秒）：
                            <input type="number" id="sd-auto-refresh-interval" 
                                   value="${settings.autoRefreshInterval / 1000}" 
                                   min="1" max="60" step="0.1"
                                   style="width: 60px; margin-left: 5px;">
                        </label>
                    </div>
                </div>                    
                
                <div id="sd-tab-api" class="sd-tab-content">
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
                        <button id="sd-fetch-models" class="sd-btn-secondary" style="flex:0 0 100px;">获取模型</button>
                    </div>
                    <div class="sd-api-row">
                        <label>最大Tokens</label>
                        <input type="number" id="sd-max-tokens" class="text_pole" value="${settings.llmConfig.maxTokens}" min="1" max="32000">
                    </div>
                    <div class="sd-api-row">
                        <label>温度 (Temperature)</label>
                        <input type="range" id="sd-temp" min="0" max="2" step="0.1" value="${settings.llmConfig.temperature}">
                        <span class="sd-range-value" id="sd-temp-val">${settings.llmConfig.temperature}</span>
                    </div>
                    <div class="sd-api-row">
                        <label>Top P</label>
                        <input type="range" id="sd-top-p" min="0" max="1" step="0.05" value="${settings.llmConfig.topP}">
                        <span class="sd-range-value" id="sd-top-p-val">${settings.llmConfig.topP}</span>
                    </div>
                    <div class="sd-api-row">
                        <label>Frequency Penalty</label>
                        <input type="range" id="sd-freq-pen" min="-2" max="2" step="0.1" value="${settings.llmConfig.frequencyPenalty}">
                        <span class="sd-range-value" id="sd-freq-pen-val">${settings.llmConfig.frequencyPenalty}</span>
                    </div>
                    <div class="sd-api-row">
                        <label>Presence Penalty</label>
                        <input type="range" id="sd-pres-pen" min="-2" max="2" step="0.1" value="${settings.llmConfig.presencePenalty}">
                        <span class="sd-range-value" id="sd-pres-pen-val">${settings.llmConfig.presencePenalty}</span>
                    </div>
                    <button id="sd-test-api" class="sd-btn-secondary" style="width:100%; margin-top:10px;">🧪 测试API连接</button>
                </div>
                
                <div class="sd-config-controls">
                    <button id="sd-export" class="sd-btn-secondary">📤 导出配置</button>
                    <button id="sd-import" class="sd-btn-secondary">📥 导入配置</button>
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
                settings.autoRefreshInterval = parseInt($('#sd-auto-refresh-interval').val()) * 1000; //
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
    ];

    const handler = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(processChatDOM, 500);
    };

    for (const ev of eventsToWatch) {
        eventOn(ev, handler);
    }
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
    ]);

    // 2. 绑定按钮事件：点击后立即执行一次 processChatDOM
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
}

})();
