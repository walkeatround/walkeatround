// ==UserScript==
// @name         生图助手 v2.0 (Refactored)
// @version      v2.0.0
// @description  重构版生图助手：数据存储在 message.extra.sdHelper，图库与正文分离
// @author       Walkeatround & AI Assistant
// @match        */*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // 模块 1: 常量与配置
    // ============================================================
    const SCRIPT_ID = 'sd_helper_v2';
    const SCRIPT_VERSION = '2.0.0';
    const DEBUG = true;

    // 标签正则
    const IMG_GEN_REGEX = /\[IMG_GEN\]([\s\S]*?)\[\/IMG_GEN\]/gi;
    const NO_GEN_FLAG = '[no_gen]';

    // 日志工具
    const log = (...args) => DEBUG && console.log(`[${SCRIPT_ID}]`, ...args);
    const warn = (...args) => console.warn(`[${SCRIPT_ID}]`, ...args);
    const error = (...args) => console.error(`[${SCRIPT_ID}]`, ...args);

    // ============================================================
    // 模块 2: 数据结构与CRUD操作
    // ============================================================

    /**
     * 数据结构版本
     * @type {number}
     */
    const DATA_VERSION = 1;

    /**
     * 创建新的图库对象
     * @param {Object} options
     * @param {string} options.prompt - 原始提示词
     * @param {number} options.paragraphIndex - 段落索引
     * @param {string} [options.contentHash] - 段落内容哈希
     * @param {string} [options.fallbackText] - 降级定位文本
     * @param {boolean} [options.preventAuto] - 是否阻止自动生图
     * @returns {Object} 图库对象
     */
    function createGallery(options) {
        return {
            id: `gallery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            anchor: {
                type: 'paragraph',
                paragraphIndex: options.paragraphIndex,
                contentHash: options.contentHash || null,
                fallbackText: options.fallbackText || null
            },
            prompt: options.prompt,
            processedPrompt: null,
            images: [],
            currentIndex: 0,
            status: 'pending', // pending | generating | ready | error
            preventAuto: options.preventAuto || false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
    }

    /**
     * 创建 sdHelper 数据结构
     * @param {Array} galleries - 图库数组
     * @returns {Object} sdHelper 数据对象
     */
    function createSdHelperData(galleries = []) {
        return {
            version: DATA_VERSION,
            galleries: galleries
        };
    }

    /**
     * 获取消息的 sdHelper 数据
     * @param {number} mesId - 消息ID
     * @returns {Object|null} sdHelper 数据或 null
     */
    function getSdHelperData(mesId) {
        try {
            const messages = TavernHelper.getChatMessages(mesId);
            if (!messages || messages.length === 0) return null;
            return messages[0].extra?.sdHelper || null;
        } catch (e) {
            error('获取 sdHelper 数据失败:', e);
            return null;
        }
    }

    /**
     * 保存 sdHelper 数据到消息
     * @param {number} mesId - 消息ID
     * @param {Object} sdHelperData - sdHelper 数据
     * @param {Object} [options] - 选项
     * @param {boolean} [options.updateMessage] - 是否同时更新消息内容
     * @param {string} [options.newMessage] - 新的消息内容
     * @returns {Promise<boolean>} 是否成功
     */
    async function saveSdHelperData(mesId, sdHelperData, options = {}) {
        try {
            const messages = TavernHelper.getChatMessages(mesId);
            if (!messages || messages.length === 0) {
                error('消息不存在:', mesId);
                return false;
            }

            const msg = messages[0];
            const updateData = {
                message_id: mesId,
                extra: {
                    ...msg.extra,
                    sdHelper: {
                        ...sdHelperData,
                        updatedAt: Date.now()
                    }
                }
            };

            // 可选：同时更新消息内容（用于清理IMG_GEN标签）
            if (options.updateMessage && options.newMessage !== undefined) {
                updateData.message = options.newMessage;
            }

            await TavernHelper.setChatMessages([updateData], { refresh: 'affected' });
            log('sdHelper 数据已保存到消息', mesId);
            return true;
        } catch (e) {
            error('保存 sdHelper 数据失败:', e);
            return false;
        }
    }

    /**
     * 更新指定图库
     * @param {number} mesId - 消息ID
     * @param {string} galleryId - 图库ID
     * @param {Object} updates - 要更新的字段
     * @returns {Promise<boolean>} 是否成功
     */
    async function updateGallery(mesId, galleryId, updates) {
        const sdHelper = getSdHelperData(mesId);
        if (!sdHelper) return false;

        const gallery = sdHelper.galleries.find(g => g.id === galleryId);
        if (!gallery) {
            warn('图库不存在:', galleryId);
            return false;
        }

        Object.assign(gallery, updates, { updatedAt: Date.now() });
        return await saveSdHelperData(mesId, sdHelper);
    }

    /**
     * 向图库添加图片
     * @param {number} mesId - 消息ID
     * @param {string} galleryId - 图库ID
     * @param {Object} imageData - 图片数据
     * @returns {Promise<boolean>} 是否成功
     */
    async function addImageToGallery(mesId, galleryId, imageData) {
        const sdHelper = getSdHelperData(mesId);
        if (!sdHelper) return false;

        const gallery = sdHelper.galleries.find(g => g.id === galleryId);
        if (!gallery) return false;

        gallery.images.push({
            url: imageData.url,
            createdAt: Date.now(),
            seed: imageData.seed || null,
            width: imageData.width || null,
            height: imageData.height || null
        });

        gallery.currentIndex = gallery.images.length - 1;
        gallery.status = 'ready';
        gallery.updatedAt = Date.now();

        return await saveSdHelperData(mesId, sdHelper);
    }

    /**
     * 从图库删除当前图片
     * @param {number} mesId - 消息ID
     * @param {string} galleryId - 图库ID
     * @returns {Promise<boolean>} 是否成功
     */
    async function deleteCurrentImage(mesId, galleryId) {
        const sdHelper = getSdHelperData(mesId);
        if (!sdHelper) return false;

        const gallery = sdHelper.galleries.find(g => g.id === galleryId);
        if (!gallery || gallery.images.length === 0) return false;

        gallery.images.splice(gallery.currentIndex, 1);
        gallery.currentIndex = Math.min(gallery.currentIndex, Math.max(0, gallery.images.length - 1));
        gallery.updatedAt = Date.now();

        return await saveSdHelperData(mesId, sdHelper);
    }

    // ============================================================
    // 模块 3: 提示词提取与处理
    // ============================================================

    /**
     * 计算字符串的简单哈希
     * @param {string} str - 输入字符串
     * @returns {string} 8位哈希值
     */
    function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
    }

    /**
     * 将消息内容分割为段落
     * @param {string} text - 消息文本
     * @returns {Array<{index: number, content: string, hash: string}>} 段落数组
     */
    function splitIntoParagraphs(text) {
        if (!text || typeof text !== 'string') return [];

        // 先移除 IMG_GEN 标签以便正确分段
        const cleanText = text.replace(IMG_GEN_REGEX, '\n\n[IMG_PLACEHOLDER]\n\n');

        // 按双换行分段
        const rawParagraphs = cleanText.split(/\n\n+/);

        const paragraphs = [];
        rawParagraphs.forEach((content, index) => {
            const trimmed = content.trim();
            // 过滤空段落和占位符
            if (trimmed && trimmed !== '[IMG_PLACEHOLDER]') {
                paragraphs.push({
                    index: paragraphs.length,
                    content: trimmed,
                    hash: simpleHash(trimmed),
                    fallbackText: trimmed.slice(0, 20)
                });
            }
        });

        return paragraphs;
    }

    /**
     * 从消息中提取 IMG_GEN 标签，返回图库数据数组
     * @param {string} messageText - 消息文本
     * @returns {Array<Object>} 图库数据数组
     */
    function extractImgGenTags(messageText) {
        if (!messageText) return [];

        const galleries = [];
        const paragraphs = splitIntoParagraphs(messageText);

        // 用于追踪当前处理位置
        let currentPos = 0;
        let paragraphIndex = 0;

        // 遍历所有 IMG_GEN 标签
        let match;
        const regex = new RegExp(IMG_GEN_REGEX.source, 'gi');

        while ((match = regex.exec(messageText)) !== null) {
            const tagStartPos = match.index;
            const prompt = match[1].trim();

            // 计算这个标签之前有多少个段落
            const textBeforeTag = messageText.slice(0, tagStartPos);
            const paragraphsBeforeTag = textBeforeTag.split(/\n\n+/).filter(p => p.trim());
            paragraphIndex = Math.max(0, paragraphsBeforeTag.length - 1);

            // 获取锚点信息
            const anchorParagraph = paragraphs[paragraphIndex];

            // 检查是否有 no_gen 标记
            const preventAuto = prompt.includes(NO_GEN_FLAG);
            const cleanPrompt = prompt.replace(NO_GEN_FLAG, '').trim();

            if (cleanPrompt) {
                galleries.push(createGallery({
                    prompt: cleanPrompt,
                    paragraphIndex: paragraphIndex,
                    contentHash: anchorParagraph?.hash || null,
                    fallbackText: anchorParagraph?.fallbackText || null,
                    preventAuto: preventAuto
                }));
            }
        }

        log(`提取到 ${galleries.length} 个 IMG_GEN 标签`);
        return galleries;
    }

    /**
     * 移除消息中的 IMG_GEN 标签
     * @param {string} messageText - 消息文本
     * @returns {string} 清理后的文本
     */
    function removeImgGenTags(messageText) {
        if (!messageText) return messageText;

        // 移除标签及其周围可能多余的换行
        let cleaned = messageText.replace(IMG_GEN_REGEX, '');

        // 清理连续多个换行为最多两个
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

        return cleaned.trim();
    }

    // ============================================================
    // 模块 4: 图库渲染
    // ============================================================

    /**
     * 生成图库的 HTML
     * @param {Object} gallery - 图库对象
     * @param {number} mesId - 消息ID
     * @returns {string} HTML 字符串
     */
    function createGalleryHtml(gallery, mesId) {
        const hasImages = gallery.images.length > 0;
        const currentImage = hasImages ? gallery.images[gallery.currentIndex] : null;
        const imageUrl = currentImage?.url || '';

        // 状态指示
        let statusClass = '';
        let statusText = '';
        switch (gallery.status) {
            case 'pending':
                statusClass = 'sd-status-pending';
                statusText = '等待生成';
                break;
            case 'generating':
                statusClass = 'sd-status-generating';
                statusText = '生成中...';
                break;
            case 'error':
                statusClass = 'sd-status-error';
                statusText = '生成失败';
                break;
        }

        // 图片计数
        const countText = hasImages
            ? `${gallery.currentIndex + 1}/${gallery.images.length}`
            : '0/0';

        return `
            <div class="sd-gallery-wrap ${statusClass}" 
                 data-mesid="${mesId}" 
                 data-gallery-id="${gallery.id}"
                 data-paragraph-index="${gallery.anchor.paragraphIndex}">
                <div class="sd-gallery-image-container">
                    ${hasImages
                ? `<img src="${imageUrl}" alt="Generated Image" loading="lazy" />`
                : `<div class="sd-gallery-placeholder">${statusText || '点击生成图片'}</div>`
            }
                </div>
                <div class="sd-gallery-controls">
                    <div class="sd-gallery-zone sd-zone-left" data-action="prev" title="上一张">◀</div>
                    <div class="sd-gallery-zone sd-zone-right" data-action="next" title="下一张/生成">▶</div>
                    <div class="sd-gallery-zone sd-zone-top" data-action="edit" title="编辑提示词">✎</div>
                    <div class="sd-gallery-zone sd-zone-delete" data-action="delete" title="删除当前图片">🗑</div>
                    <div class="sd-gallery-count">${countText}</div>
                </div>
                <div class="sd-gallery-prompt" title="${escapeHtml(gallery.prompt)}">
                    ${escapeHtml(gallery.prompt.slice(0, 50))}${gallery.prompt.length > 50 ? '...' : ''}
                </div>
            </div>
        `.trim();
    }

    /**
     * HTML 转义
     */
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * 根据锚点定位段落位置
     * @param {Array} paragraphs - DOM 中的段落元素数组
     * @param {Object} anchor - 锚点信息
     * @returns {number} 应该插入的位置索引
     */
    function locateInsertPosition(paragraphs, anchor) {
        if (!paragraphs || paragraphs.length === 0) return 0;
        if (anchor.paragraphIndex >= paragraphs.length) return paragraphs.length - 1;

        // 优先使用索引
        let targetIndex = anchor.paragraphIndex;

        // 验证哈希（可选，如果需要更精确的定位）
        if (anchor.contentHash) {
            const targetParagraph = paragraphs[targetIndex];
            if (targetParagraph) {
                const currentHash = simpleHash(targetParagraph.textContent || targetParagraph.innerText || '');
                if (currentHash !== anchor.contentHash) {
                    log('段落哈希不匹配，尝试使用 fallbackText 定位');
                    // 尝试使用 fallbackText 查找
                    if (anchor.fallbackText) {
                        for (let i = 0; i < paragraphs.length; i++) {
                            const text = paragraphs[i].textContent || paragraphs[i].innerText || '';
                            if (text.trim().startsWith(anchor.fallbackText)) {
                                targetIndex = i;
                                log(`通过 fallbackText 定位到段落 ${i}`);
                                break;
                            }
                        }
                    }
                }
            }
        }

        return targetIndex;
    }

    /**
     * 为指定消息渲染所有图库
     * @param {number} mesId - 消息ID
     */
    function renderGalleriesForMessage(mesId) {
        const sdHelper = getSdHelperData(mesId);
        if (!sdHelper || !sdHelper.galleries || sdHelper.galleries.length === 0) {
            return;
        }

        const $mesBlock = $(`.mes[mesid="${mesId}"]`);
        if (!$mesBlock.length) return;

        const $mesText = $mesBlock.find('.mes_text');
        if (!$mesText.length) return;

        // 移除可能存在的旧图库
        $mesText.find('.sd-gallery-wrap').remove();

        // 获取段落元素
        // 注意：这里需要根据实际 DOM 结构调整选择器
        const paragraphElements = [];
        $mesText.contents().each(function () {
            if (this.nodeType === 3) { // 文本节点
                const text = this.textContent.trim();
                if (text) paragraphElements.push(this);
            } else if (this.nodeType === 1) { // 元素节点
                paragraphElements.push(this);
            }
        });

        // 按段落索引排序图库，从后往前插入以避免索引错乱
        const sortedGalleries = [...sdHelper.galleries]
            .sort((a, b) => b.anchor.paragraphIndex - a.anchor.paragraphIndex);

        sortedGalleries.forEach(gallery => {
            const insertIndex = locateInsertPosition(paragraphElements, gallery.anchor);
            const galleryHtml = createGalleryHtml(gallery, mesId);

            if (insertIndex < paragraphElements.length) {
                $(paragraphElements[insertIndex]).after(galleryHtml);
            } else {
                $mesText.append(galleryHtml);
            }
        });

        log(`已为消息 ${mesId} 渲染 ${sdHelper.galleries.length} 个图库`);
    }

    // ============================================================
    // 模块 5: 图片生成
    // ============================================================

    /**
     * 触发图库生图
     * @param {number} mesId - 消息ID
     * @param {string} galleryId - 图库ID
     */
    async function triggerGeneration(mesId, galleryId) {
        const sdHelper = getSdHelperData(mesId);
        if (!sdHelper) return;

        const gallery = sdHelper.galleries.find(g => g.id === galleryId);
        if (!gallery) return;

        // 更新状态为生成中
        gallery.status = 'generating';
        await saveSdHelperData(mesId, sdHelper);

        // 刷新 DOM 显示
        updateGalleryDom(mesId, galleryId, gallery);

        try {
            // 调用 SD 生图（使用酒馆的 /sd 命令）
            const prompt = gallery.processedPrompt || gallery.prompt;
            log('开始生成图片:', prompt);

            // 触发 /sd 斜杠命令
            await TavernHelper.triggerSlash(`/sd ${prompt}`);

            // 注意：实际图片URL需要通过其他方式获取
            // 这里需要监听生图完成事件或使用其他机制

        } catch (e) {
            error('生图失败:', e);
            gallery.status = 'error';
            await saveSdHelperData(mesId, sdHelper);
            updateGalleryDom(mesId, galleryId, gallery);
        }
    }

    /**
     * 更新图库 DOM（不重新渲染整个消息）
     * @param {number} mesId - 消息ID
     * @param {string} galleryId - 图库ID
     * @param {Object} gallery - 图库数据
     */
    function updateGalleryDom(mesId, galleryId, gallery) {
        const $gallery = $(`.sd-gallery-wrap[data-mesid="${mesId}"][data-gallery-id="${galleryId}"]`);
        if (!$gallery.length) return;

        const newHtml = createGalleryHtml(gallery, mesId);
        $gallery.replaceWith(newHtml);
    }

    // ============================================================
    // 模块 6: 事件处理与交互
    // ============================================================

    /**
     * 初始化全局事件监听
     */
    function initEventListeners() {
        // 使用事件委托处理所有图库交互
        $(document).on('click', '.sd-gallery-zone', async function (e) {
            e.stopPropagation();

            const $zone = $(this);
            const $gallery = $zone.closest('.sd-gallery-wrap');
            const mesId = parseInt($gallery.data('mesid'), 10);
            const galleryId = $gallery.data('gallery-id');
            const action = $zone.data('action');

            log('图库交互:', { mesId, galleryId, action });

            const sdHelper = getSdHelperData(mesId);
            if (!sdHelper) return;

            const gallery = sdHelper.galleries.find(g => g.id === galleryId);
            if (!gallery) return;

            switch (action) {
                case 'prev':
                    if (gallery.images.length > 0) {
                        gallery.currentIndex = Math.max(0, gallery.currentIndex - 1);
                        await saveSdHelperData(mesId, sdHelper);
                        updateGalleryDom(mesId, galleryId, gallery);
                    }
                    break;

                case 'next':
                    if (gallery.images.length > 0 && gallery.currentIndex < gallery.images.length - 1) {
                        gallery.currentIndex++;
                        await saveSdHelperData(mesId, sdHelper);
                        updateGalleryDom(mesId, galleryId, gallery);
                    } else {
                        // 最后一张或无图时，生成新图
                        await triggerGeneration(mesId, galleryId);
                    }
                    break;

                case 'delete':
                    if (gallery.images.length > 0) {
                        await deleteCurrentImage(mesId, galleryId);
                        // 重新获取数据并更新 DOM
                        const updatedSdHelper = getSdHelperData(mesId);
                        const updatedGallery = updatedSdHelper?.galleries.find(g => g.id === galleryId);
                        if (updatedGallery) {
                            updateGalleryDom(mesId, galleryId, updatedGallery);
                        }
                    }
                    break;

                case 'edit':
                    openPromptEditor(mesId, galleryId, gallery);
                    break;
            }
        });

        // 图片点击预览（新标签页打开）
        $(document).on('click', '.sd-gallery-image-container img', function (e) {
            e.stopPropagation();
            const url = $(this).attr('src');
            if (url) {
                window.open(url, '_blank');
            }
        });

        // 无图时点击生成
        $(document).on('click', '.sd-gallery-placeholder', async function (e) {
            e.stopPropagation();
            const $gallery = $(this).closest('.sd-gallery-wrap');
            const mesId = parseInt($gallery.data('mesid'), 10);
            const galleryId = $gallery.data('gallery-id');
            await triggerGeneration(mesId, galleryId);
        });

        log('全局事件监听已初始化');
    }

    /**
     * 打开提示词编辑器
     */
    async function openPromptEditor(mesId, galleryId, gallery) {
        // 使用酒馆的弹窗系统
        const newPrompt = await SillyTavern.callGenericPopup(
            `<textarea id="sd-prompt-edit" style="width:100%;height:200px;resize:vertical;">${escapeHtml(gallery.prompt)}</textarea>`,
            2, // POPUP_TYPE.CONFIRM
            '编辑提示词',
            {
                okButton: '保存',
                cancelButton: '取消'
            }
        );

        if (newPrompt !== null) {
            const $textarea = $('#sd-prompt-edit');
            const updatedPrompt = $textarea.val().trim();

            if (updatedPrompt && updatedPrompt !== gallery.prompt) {
                await updateGallery(mesId, galleryId, {
                    prompt: updatedPrompt,
                    processedPrompt: null // 清空处理后的提示词，等待重新处理
                });

                // 刷新 DOM
                const updatedSdHelper = getSdHelperData(mesId);
                const updatedGallery = updatedSdHelper?.galleries.find(g => g.id === galleryId);
                if (updatedGallery) {
                    updateGalleryDom(mesId, galleryId, updatedGallery);
                }

                log('提示词已更新:', updatedPrompt);
            }
        }
    }

    // ============================================================
    // 模块 7: 主流程与初始化
    // ============================================================

    /**
     * 处理新消息
     */
    async function handleNewMessage(mesId) {
        try {
            const messages = TavernHelper.getChatMessages(mesId);
            if (!messages || messages.length === 0) return;

            const msg = messages[0];

            // 只处理 AI 消息
            if (msg.role !== 'assistant') return;

            // 检查是否已有 sdHelper 数据
            if (msg.extra?.sdHelper?.version >= DATA_VERSION) {
                log('消息已有 sdHelper 数据，跳过提取');
                renderGalleriesForMessage(mesId);
                return;
            }

            // 提取 IMG_GEN 标签
            const galleries = extractImgGenTags(msg.message);
            if (galleries.length === 0) {
                log('消息中没有 IMG_GEN 标签');
                return;
            }

            // 清理正文中的标签
            const cleanedMessage = removeImgGenTags(msg.message);

            // 创建 sdHelper 数据
            const sdHelperData = createSdHelperData(galleries);

            // 保存到消息
            await saveSdHelperData(mesId, sdHelperData, {
                updateMessage: true,
                newMessage: cleanedMessage
            });

            // 渲染图库
            renderGalleriesForMessage(mesId);

            // 触发自动生图（对于没有 preventAuto 的图库）
            for (const gallery of galleries) {
                if (!gallery.preventAuto) {
                    // 延迟一点执行，避免阻塞
                    setTimeout(() => triggerGeneration(mesId, gallery.id), 100);
                }
            }

            log('新消息处理完成:', mesId);
        } catch (e) {
            error('处理新消息失败:', e);
        }
    }

    /**
     * 处理消息渲染完成
     */
    function handleMessageRendered(mesId) {
        renderGalleriesForMessage(mesId);
    }

    /**
     * 注册酒馆事件
     */
    function registerTavernEvents() {
        // 监听新消息
        eventOn(tavern_events.MESSAGE_RECEIVED, async (mesId) => {
            log('MESSAGE_RECEIVED:', mesId);
            await handleNewMessage(mesId);
        });

        // 监听消息渲染完成
        eventOn(tavern_events.CHARACTER_MESSAGE_RENDERED, (mesId) => {
            log('CHARACTER_MESSAGE_RENDERED:', mesId);
            handleMessageRendered(mesId);
        });

        // 监听聊天切换
        eventOn(tavern_events.CHAT_CHANGED, () => {
            log('CHAT_CHANGED - 重新渲染所有图库');
            // 延迟执行，等待 DOM 更新
            setTimeout(() => {
                const lastMesId = TavernHelper.getLastMessageId();
                for (let i = 0; i <= lastMesId; i++) {
                    renderGalleriesForMessage(i);
                }
            }, 500);
        });

        log('酒馆事件已注册');
    }

    /**
     * 注入 CSS 样式
     */
    function injectStyles() {
        const css = `
            .sd-gallery-wrap {
                position: relative;
                max-width: 400px;
                margin: 10px auto;
                border-radius: 8px;
                overflow: hidden;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .sd-gallery-image-container {
                position: relative;
                min-height: 200px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .sd-gallery-image-container img {
                max-width: 100%;
                max-height: 500px;
                display: block;
                cursor: pointer;
            }

            .sd-gallery-placeholder {
                padding: 50px 20px;
                text-align: center;
                color: rgba(255, 255, 255, 0.5);
                cursor: pointer;
            }

            .sd-gallery-placeholder:hover {
                background: rgba(255, 255, 255, 0.1);
            }

            .sd-gallery-controls {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
            }

            .sd-gallery-zone {
                position: absolute;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.2s, background 0.2s;
                cursor: pointer;
                pointer-events: auto;
                color: white;
                font-size: 20px;
                text-shadow: 0 0 4px black;
            }

            .sd-gallery-wrap:hover .sd-gallery-zone {
                opacity: 0.7;
            }

            .sd-gallery-zone:hover {
                opacity: 1 !important;
                background: rgba(0, 0, 0, 0.5);
            }

            .sd-zone-left {
                left: 0;
                top: 20%;
                bottom: 20%;
                width: 25%;
            }

            .sd-zone-right {
                right: 0;
                top: 20%;
                bottom: 20%;
                width: 25%;
            }

            .sd-zone-top {
                top: 0;
                left: 20%;
                right: 20%;
                height: 20%;
            }

            .sd-zone-delete {
                left: 0;
                bottom: 0;
                width: 20%;
                height: 20%;
                font-size: 16px;
            }

            .sd-gallery-count {
                position: absolute;
                right: 8px;
                bottom: 8px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 12px;
                pointer-events: none;
            }

            .sd-gallery-prompt {
                padding: 8px;
                font-size: 11px;
                color: rgba(255, 255, 255, 0.6);
                background: rgba(0, 0, 0, 0.2);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .sd-status-pending .sd-gallery-image-container {
                background: rgba(255, 193, 7, 0.1);
            }

            .sd-status-generating .sd-gallery-image-container {
                background: rgba(33, 150, 243, 0.1);
            }

            .sd-status-generating .sd-gallery-placeholder::after {
                content: '';
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: sd-spin 1s linear infinite;
                margin-left: 10px;
                vertical-align: middle;
            }

            .sd-status-error .sd-gallery-image-container {
                background: rgba(244, 67, 54, 0.1);
            }

            @keyframes sd-spin {
                to { transform: rotate(360deg); }
            }
        `;

        const $style = $('<style>').attr('id', `${SCRIPT_ID}-styles`).text(css);
        $('head').append($style);
        log('CSS 样式已注入');
    }

    /**
     * 初始化脚本
     */
    async function init() {
        log(`初始化 ${SCRIPT_ID} v${SCRIPT_VERSION}`);

        // 检查依赖
        if (typeof TavernHelper === 'undefined') {
            error('TavernHelper 不可用，脚本无法运行');
            return;
        }

        if (typeof eventOn === 'undefined') {
            error('eventOn 不可用，脚本无法运行');
            return;
        }

        // 注入样式
        injectStyles();

        // 初始化事件监听
        initEventListeners();

        // 注册酒馆事件
        registerTavernEvents();

        log('脚本初始化完成');
    }

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
