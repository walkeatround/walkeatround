// 脚本名称: 调试版状态栏提取器
// 描述: 带完整调试信息的版本

// 启动时显示提示
console.log('====== 状态栏提取器脚本已加载 ======');
toastr.info('状态栏提取器已加载，等待消息...', '脚本启动');

// 提取函数
function extractStatbars(content) {
  console.log('📝 正在检查内容:', content);
  const regex = /\[statbar\]([\s\S]*?)\[\/statbar\]/g;
  const matches = [...content.matchAll(regex)];
  console.log('🔍 找到匹配数量:', matches.length);
  
  if (matches.length > 0) {
    matches.forEach((match, index) => {
      console.log(`匹配 ${index + 1}:`, match[1]);
    });
  }
  
  return matches.map(match => match[1].trim());
}

// 显示提取结果
function displayResult(messageElement, extractedContents, eventSource) {
  console.log(`💡 准备显示提取结果 (${eventSource}):`, extractedContents);
  
  const displayContent = `
    <div style="background: #2a2a2a; border: 2px solid #4a9eff; border-radius: 8px; padding: 15px; margin: 10px 0; font-family: Arial, sans-serif;">
      <div style="color: #4ade80; font-size: 18px; font-weight: bold; margin-bottom: 10px;">
        ✅ 提取成功！(${eventSource})
      </div>
      <div style="color: #e0e0e0; font-size: 14px; line-height: 1.6;">
        <strong>提取到 ${extractedContents.length} 个状态栏：</strong>
        <div style="margin-top: 10px; white-space: pre-wrap; background: #1a1a1a; padding: 10px; border-radius: 4px;">
          ${extractedContents.map((content, index) => 
            `<div style="margin: 10px 0; border-left: 3px solid #4a9eff; padding-left: 10px;">${content.replace(/\n/g, '<br>')}</div>`
          ).join('')}
        </div>
      </div>
    </div>
  `;
  
  messageElement.find('.statbar-extract-result').remove();
  messageElement.append(`<div class="statbar-extract-result">${displayContent}</div>`);
  console.log('✅ 显示成功');
}

// 1. 监听角色消息渲染事件
eventOn(tavern_events.CHARACTER_MESSAGE_RENDERED, async (message_id) => {
  console.log('🎨 [渲染事件触发] message_id:', message_id);
  
  try {
    const messages = getChatMessages(message_id);
    console.log('📨 获取到的消息:', messages);
    
    if (!messages || messages.length === 0) {
      console.warn('⚠️ 没有获取到消息');
      return;
    }
    
    const content = messages[0].message;
    console.log('📄 消息内容长度:', content.length);
    console.log('📄 消息内容:', content);
    
    const extractedContents = extractStatbars(content);
    
    if (extractedContents.length > 0) {
      console.log('✅ 提取成功，准备显示');
      toastr.success(`提取到 ${extractedContents.length} 个状态栏`, '渲染事件');
      
      const messageElement = retrieveDisplayedMessage(message_id);
      console.log('🎯 获取到的 DOM 元素:', messageElement);
      
      if (messageElement.length > 0) {
        displayResult(messageElement, extractedContents, '渲染时');
      } else {
        console.warn('⚠️ 无法获取消息 DOM 元素');
      }
    } else {
      console.log('❌ 没有找到 [statbar] 标签');
    }
  } catch (error) {
    console.error('❌ [渲染时] 提取错误:', error);
    toastr.error('提取失败：' + error.message, '错误');
  }
});

// 2. 监听消息接收事件
eventOn(tavern_events.MESSAGE_RECEIVED, async (message_id) => {
  console.log('📬 [消息接收事件触发] message_id:', message_id);
  
  try {
    const messages = getChatMessages(message_id);
    if (!messages || messages.length === 0) {
      console.warn('⚠️ [消息接收] 没有获取到消息');
      return;
    }
    
    const content = messages[0].message;
    const extractedContents = extractStatbars(content);
    
    if (extractedContents.length > 0) {
      console.log('✅ [消息接收] 提取结果:', extractedContents);
      toastr.info(`接收到 ${extractedContents.length} 个状态栏`, '消息接收');
    }
  } catch (error) {
    console.error('❌ [消息接收] 错误:', error);
  }
});

// 3. 监听生成结束事件
eventOn(tavern_events.GENERATION_ENDED, async (message_id) => {
  console.log('🎯 [生成结束事件触发] message_id:', message_id);
  
  try {
    const messages = getChatMessages(message_id);
    if (!messages || messages.length === 0) {
      console.warn('⚠️ [生成结束] 没有获取到消息');
      return;
    }
    
    const content = messages[0].message;
    const extractedContents = extractStatbars(content);
    
    if (extractedContents.length > 0) {
      console.log('✅ [生成结束] 提取结果:', extractedContents);
      toastr.success(`生成完成，包含 ${extractedContents.length} 个状态栏`, '生成结束');
    }
  } catch (error) {
    console.error('❌ [生成结束] 错误:', error);
  }
});

console.log('====== 监听器已全部注册 ======');
