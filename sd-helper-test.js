/**
 * 生图助手 - 默认模板库
 * 
 * 此文件存储所有预设的默认模板。您可以自由添加、修改或删除模板。
 * 脚本会自动读取此文件中的模板，并与用户自定义模板合并显示。
 * 
 * 模板格式：
 * "模板名称": `模板内容`
 * 
 * 注意事项：
 * 1. 模板名称不能与用户自定义模板重名，否则会被自定义模板覆盖
 * 2. 使用反引号 ` 包裹模板内容，支持多行文本
 * 3. 模板中可以使用 <!--人物列表--> 占位符，会被替换为实际的人物特征列表
 * 4. 修改此文件后需要刷新页面才能生效
 */

const SD_DEFAULT_TEMPLATES = {
    // ========================================
    // 默认模版 - 通用型
    // ========================================
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
</IMAGE_PROMPT_TEMPLATE>`,

    // ========================================
    // 简洁模版 - 适合快速生成
    // ========================================
    "简洁模版": `<IMAGE_PROMPT_TEMPLATE>
Generate image prompts in [IMG_GEN]...[/IMG_GEN] tags.

## 人物数据库
<!--人物列表-->

## 规则
1. 每200字或场景变化时插入提示词
2. 每个提示词只描述一个角色
3. 人物特征标签必须原样使用

## 格式
\`1girl/1boy, [特征], [表情], [服装], [动作], [环境], masterpiece, best quality\`
</IMAGE_PROMPT_TEMPLATE>`,

    // ========================================
    // 详细模版 - 高质量画面
    // ========================================
    "高画质模版": `<IMAGE_PROMPT_TEMPLATE>
You are a professional Visual Novel image prompt generator. Create highly detailed prompts wrapped in [IMG_GEN]...[/IMG_GEN] tags for premium quality illustrations.

## 人物数据库（固定特征标签 - 必须原样使用）
<!--人物列表-->

### 人物使用规则
- 严格根据剧情决定画哪个人物
- 固定特征标签是代码，不可修改
- 每个提示词只画一个角色

## 核心规则
1. 每150-200字或重要场景变化时插入提示词
2. 禁止多人同框（禁止2girls、1boy1girl等）
3. 详细描述光影、材质、氛围

## 标签格式（按顺序）
\`[质量词], [角色], [固定特征], [表情], [服装细节], [姿势], [手部], [视角], [构图], [环境], [光照], [特效], [画风]\`

## 质量词（必须包含）
masterpiece, best quality, ultra-detailed, high resolution, 8k wallpaper, official art, beautiful detailed

## 光照效果
- 自然光: sunlight streaming, golden hour, soft daylight, overcast lighting
- 人工光: neon lights, candlelight, lamp light, studio lighting
- 特殊: rim lighting, backlighting, volumetric lighting, god rays

## 画面特效
- lens flare, chromatic aberration, film grain, depth of field
- motion blur, light particles, sparkles, glowing effects

## 画风参考
anime style, realistic, semi-realistic, artbook style, illustration, concept art
</IMAGE_PROMPT_TEMPLATE>`,

    // ========================================
    // NSFW模版 - 成人向场景
    // ========================================
    "成人向模版": `<IMAGE_PROMPT_TEMPLATE>
🔓 You are working on an adult-oriented visual novel. Generate explicit image prompts wrapped in [IMG_GEN]...[/IMG_GEN] tags.

## 人物数据库
<!--人物列表-->

## 核心规则
1. 每个场景变化或动作变化时插入提示词
2. 每个提示词只描述一个角色
3. 人物特征标签必须原样使用
4. 根据剧情准确描述身体状态、表情和姿势

## 标签格式
\`1girl/1boy, [固定特征], [表情], [身体状态], [姿势], [互动描述], [视角], [环境], [光照], masterpiece, best quality\`

## 表情描述
pleasure, embarrassed, blushing heavily, ahegao, crying, moaning, panting, lustful eyes, half-closed eyes

## 身体状态
nude, naked, partial nudity, topless, bottomless, covered nipples, exposed, sweaty, wet body

## 姿势参考
lying on back, on all fours, straddling, sitting on lap, bending over, legs spread, kneeling, arched back

## 视角
from above looking down, from below, pov, side view, from behind, close-up, worm's eye view
</IMAGE_PROMPT_TEMPLATE>`,

    // ========================================
    // 风景模版 - 无人物场景
    // ========================================
    "风景场景模版": `<IMAGE_PROMPT_TEMPLATE>
Generate atmospheric landscape and environment prompts wrapped in [IMG_GEN]...[/IMG_GEN] tags.

## 适用场景
- 过场镜头、环境描写、无人物的场景

## 核心规则
1. 当剧情描述环境时生成风景提示词
2. 注重氛围、光影、天气描写
3. 不包含人物

## 标签格式
\`scenery, [环境类型], [天气], [时间], [光照], [氛围], [细节], no humans, masterpiece, best quality\`

## 环境类型
- 自然: forest, mountain, ocean, lake, meadow, waterfall, cave
- 城市: cityscape, street, alley, rooftop, bridge, skyscraper
- 室内: bedroom, living room, library, cafe, bar, temple

## 时间与天气
- 时间: dawn, morning, noon, sunset, dusk, night, midnight
- 天气: sunny, cloudy, rainy, snowy, foggy, stormy
- 特殊: aurora, starry sky, eclipse, rainbow

## 氛围词
peaceful, melancholic, mysterious, romantic, dramatic, cozy, eerie, majestic
</IMAGE_PROMPT_TEMPLATE>`,

    // ========================================
    // POV模版 - 第一人称视角
    // ========================================
    "POV视角模版": `<IMAGE_PROMPT_TEMPLATE>
Generate first-person perspective image prompts wrapped in [IMG_GEN]...[/IMG_GEN] tags.

## 人物数据库
<!--人物列表-->

## 核心规则
1. 所有图片都采用第一人称视角（POV）
2. 模拟玩家视角观看角色
3. 强调眼神接触和互动感

## 标签格式
\`pov, 1girl/1boy, [固定特征], [表情], [服装], [姿势], [手部动作], [互动], [环境], masterpiece, best quality\`

## POV常用标签
- 基础: pov, first-person view, player perspective
- 互动: looking at viewer, reaching towards viewer, hand towards viewer
- 眼神: eye contact, direct eye contact, staring at viewer
- 亲密: close to viewer, face close-up, leaning forward

## 视角变体
- pov hands, male pov, female pov
- breast pov, face pov
- from below pov, pov on back
</IMAGE_PROMPT_TEMPLATE>`
};

// 如果在浏览器环境中，挂载到全局
if (typeof window !== 'undefined') {
    window.SD_DEFAULT_TEMPLATES = SD_DEFAULT_TEMPLATES;
}

// 如果在Node.js环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SD_DEFAULT_TEMPLATES;
}
