// 脚本名称: 增强版状态栏提取器
// 描述: 在多个时机检测并提取 [statbar] 标签内容

// 提取函数（复用代码）
function extractStatbars(content) {
  const regex = /\[statbar\]([\s\S]*?)\[\/statbar\]/gsi;
  const matches = [...content.matchAll(regex)];
  return matches.map(match => match[1].trim());
}

// 显示提取结果
function displayResult(messageElement, extractedContents, eventSource) {
  const displayContent = `
    <div style="background: #2a2a2a; border: 2px solid #4a9eff; border-radius: 8px; padding: 15px; margin: 10px 0; font-family: Arial, sans-serif;">
      <div style="color: #4ade80; font-size: 18px; font-weight: bold; margin-bottom: 10px;">
        ✅ 提取成功！(${eventSource})
      </div>
      <div style="color: #e0e0e0; font-size: 14px; line-height: 1.6;">
        <strong>提取到 ${extractedContents.length} 个状态栏：</strong>
        <ul style="margin-top: 10px; padding-left: 20px;">
          ${extractedContents.map((content, index) => 
            `<li style="margin: 5px 0;">${content}</li>`
          ).join('')}
        </ul>
      </div>
    </div>
  `;
  
  messageElement.find('.statbar-extract-result').remove();
  messageElement.append(`<div class="statbar-extract-result">${displayContent}</div>`);
}

// 1. 监听角色消息渲染事件 - 最适合显示提取结果
// 时机：消息已经渲染到页面上，可以操作DOM
eventOn(tavern_events.CHARACTER_MESSAGE_RENDERED, async (message_id) => {
  try {
    const messages = getChatMessages(message_id);
    if (!messages || messages.length === 0) return;
    
    const content = messages[0].message;
    const extractedContents = extractStatbars(content);
    
    if (extractedContents.length > 0) {
      const messageElement = retrieveDisplayedMessage(message_id);
      if (messageElement.length > 0) {
        displayResult(messageElement, extractedContents, '渲染时');
      }
      console.log('📊 [渲染时] 提取结果:', extractedContents);
    }
  } catch (error) {
    console.error('[渲染时] 提取错误:', error);
  }
});

// 2. 监听消息接收事件 - 最早获得消息内容
// 时机：消息刚收到，还未渲染到页面
eventOn(tavern_events.MESSAGE_RECEIVED, async (message_id) => {
  try {
    const messages = getChatMessages(message_id);
    if (!messages || messages.length === 0) return;
    
    const content = messages[0].message;
    const extractedContents = extractStatbars(content);
    
    if (extractedContents.length > 0) {
      console.log('📬 [消息接收] 提取结果:', extractedContents);
      toastr.info(`收到 ${extractedContents.length} 个状态栏`, '消息接收');
      
      // 可以在这里对数据进行处理、保存等操作
      // 例如保存到变量中
      await insertOrAssignVariables({
        'last_statbars': extractedContents
      }, { type: 'chat' });
    }
  } catch (error) {
    console.error('[消息接收] 提取错误:', error);
  }
});

// 3. 监听生成结束事件 - 确保AI生成完整
// 时机：AI完整生成完毕
eventOn(tavern_events.GENERATION_ENDED, async (message_id) => {
  try {
    const messages = getChatMessages(message_id);
    if (!messages || messages.length === 0) return;
    
    const content = messages[0].message;
    const extractedContents = extractStatbars(content);
    
    if (extractedContents.length > 0) {
      console.log('🎯 [生成结束] 提取结果:', extractedContents);
      toastr.success(`AI生成包含 ${extractedContents.length} 个状态栏`, '生成完成');
    }
  } catch (error) {
    console.error('[生成结束] 提取错误:', error);
  }
});

// 4. 监听消息更新事件 - 消息被编辑时
// 时机：用户或脚本修改了消息内容
eventOn(tavern_events.MESSAGE_UPDATED, async (message_id) => {
  try {
    const messages = getChatMessages(message_id);
    if (!messages || messages.length === 0) return;
    
    const content = messages[0].message;
    const extractedContents = extractStatbars(content);
    
    if (extractedContents.length > 0) {
      console.log('✏️ [消息更新] 提取结果:', extractedContents);
    }
  } catch (error) {
    console.error('[消息更新] 提取错误:', error);
  }
});

toastr.info('增强版状态栏提取器已加载', '脚本启动');
