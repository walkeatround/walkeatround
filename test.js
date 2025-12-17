// 脚本名称: 简单状态栏提取器
// 描述: 检测并提取消息中的 [statbar] 标签内容

// 监听角色消息渲染事件
eventOn(tavern_events.CHARACTER_MESSAGE_RENDERED, async (message_id) => {
  try {
    // 获取当前消息
    const messages = getChatMessages(message_id);
    if (!messages || messages.length === 0) return;
    
    const message = messages[0];
    const content = message.message;
    
    // 使用正则表达式匹配 [statbar] 标签
    const regex = /\[statbar\](.*?)\[\/statbar\]/gs;
    const matches = [...content.matchAll(regex)];
    
    // 如果找到匹配内容
    if (matches.length > 0) {
      // 提取所有内容
      const extractedContents = matches.map(match => match[1].trim());
      
      // 创建显示界面
      const displayContent = `
        <div style="background: #2a2a2a; border: 2px solid #4a9eff; border-radius: 8px; padding: 15px; margin: 10px 0; font-family: Arial, sans-serif;">
          <div style="color: #4ade80; font-size: 18px; font-weight: bold; margin-bottom: 10px;">
            ✅ 提取成功！
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
      
      // 在消息下方添加显示
      const messageElement = retrieveDisplayedMessage(message_id);
      if (messageElement.length > 0) {
        // 移除之前的提取结果（如果存在）
        messageElement.find('.statbar-extract-result').remove();
        // 添加新的提取结果
        messageElement.append(`<div class="statbar-extract-result">${displayContent}</div>`);
      }
      
      // 同时在控制台输出
      console.log('📊 状态栏提取结果:', extractedContents);
      
      // 显示提示消息
      toastr.success(`成功提取 ${extractedContents.length} 个状态栏信息`, '提取完成');
    }
  } catch (error) {
    console.error('状态栏提取错误:', error);
    toastr.error('提取状态栏时出错', '错误');
  }
});

// 脚本加载成功提示
toastr.info('状态栏提取器已加载', '脚本启动');
