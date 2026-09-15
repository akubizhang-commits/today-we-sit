'use strict';

// Original, deterministic content. Helpers expand geometry and prose only:
// every cast, constraint set and reference placement below is hand-designed.
const chapters = [
  { id: 0, title: '社区接驳车', subtitle: '带着早餐，慢慢出发', color: '#A8BA99' },
  { id: 1, title: '庭院野餐', subtitle: '把晚餐摆到树影下面', color: '#C66949' },
  { id: 2, title: '露天电影', subtitle: '等星星亮起，一起入座', color: '#758CA8' }
];

const colors = ['#D5986D', '#8FAE92', '#819CB8', '#BB88A0', '#C4AA61', '#91AAA7', '#AD96BA', '#C68C80'];
const tagLabels = {
  window: '靠窗', door: '车门旁', front: '第一排', middle: '中间排', back: '最后一排',
  left: '最左侧', center: '非两端', right: '最右侧',
  shade: '树荫下', serving: '取餐侧', lantern: '灯笼旁',
  screen: '银幕前排', speaker: '音箱旁', edge: '排的两端',
  row1: '第一排', row2: '第二排', row3: '第三排'
};
const zoneLabels = {
  front: '车厢前排', middle: '车厢中排', back: '车厢后排',
  garden: '花园侧', kitchen: '餐台侧', screen: '银幕前排', rear: '观影后排'
};

function grid(chapter, cols, rows) {
  const seats = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tags = [`row${y + 1}`, x === 0 ? 'left' : x === cols - 1 ? 'right' : 'center'];
      if (y === 0) tags.push('front');
      if (y === rows - 1) tags.push('back');
      if (y > 0 && y < rows - 1) tags.push('middle');
      let zone;
      if (chapter === 0) {
        zone = y === 0 ? 'front' : y === rows - 1 ? 'back' : 'middle';
        if (x === 0) tags.push('window');
        if (x === cols - 1 && y === 0) tags.push('door');
      } else if (chapter === 1) {
        zone = y === 0 ? 'garden' : 'kitchen';
        if (x === 0) tags.push('shade');
        if (x === cols - 1) tags.push('serving');
        if (x === 1 && y === 1) tags.push('lantern');
      } else {
        zone = y === 0 ? 'screen' : 'rear';
        if (y === 0) tags.push('screen');
        if (x === cols - 1) tags.push('speaker');
        if (x === 0 || x === cols - 1) tags.push('edge');
        if (y === 1 && x < 2) tags.push('shade');
      }
      seats.push({ id: `s${seats.length + 1}`, x, y, tags, zone });
    }
  }
  const adjacency = [];
  for (const seat of seats) {
    const right = seats.find(other => other.y === seat.y && other.x === seat.x + 1);
    if (right) adjacency.push([seat.id, right.id]);
  }
  return { seats, adjacency };
}

const tag = value => ({ type: 'tag', value, text: `想坐${tagLabels[value]}的位置` });
const not = value => ({ type: 'notTag', value, text: `不坐${tagLabels[value]}的位置` });
const zone = value => ({ type: 'zone', value, text: `想坐${zoneLabels[value]}` });
const beside = person => ({ type: 'adjacent', person: `p${person}` });
const apart = person => ({ type: 'apart', person: `p${person}` });
const space = () => ({ type: 'emptyNeighbor', text: '左右至少留一个相邻空位' });

function level(id, title, intro, cols, rows, cast, reference) {
  const chapter = Math.floor((id - 1) / 10);
  const people = cast.map(([name, ...rules], i) => ({
    id: `p${i + 1}`, name, color: colors[i], rules
  }));
  for (const person of people) {
    for (const rule of person.rules) {
      if (rule.person) {
        const other = people.find(candidate => candidate.id === rule.person);
        rule.text = rule.type === 'adjacent' ? `想和${other.name}左右相邻` : `不和${other.name}左右相邻`;
      }
    }
  }
  return {
    id, chapter, title, intro, ...grid(chapter, cols, rows), people,
    reference: Object.fromEntries(people.map((person, i) => [person.id, `s${reference[i]}`]))
  };
}

const levels = [
  level(1, '车窗里的云', '小满想看云。左侧靠窗，右侧是车门旁。', 2, 1, [
    ['小满', tag('window')]
  ], [1]),
  level(2, '早餐别吹凉', '阿穗想靠窗，阿陶想避开窗边，各找一个座位吧。', 2, 1, [
    ['阿穗', tag('window')],
    ['阿陶', not('window')]
  ], [1, 2]),
  level(3, '后排悄悄话', '把两位朋友安排到后排。同排左右挨着才算相邻。', 2, 2, [
    ['圆圆', zone('back')],
    ['小岚', beside(1)]
  ], [3, 4]),
  level(4, '下一站花市', '花篮已经放好，三位邻居准备去逛花市。', 2, 2, [
    ['青禾', tag('window'), zone('front')],
    ['阿榆', beside(1)],
    ['林叔', not('door')]
  ], [1, 2, 3]),
  level(5, '给纸风车留空', '小游手里的纸风车需要一点空间，空位也能帮上忙。', 2, 3, [
    ['阿杏', tag('window'), zone('back')],
    ['小游', zone('middle'), space()],
    ['苏苏', zone('front'), not('window')]
  ], [5, 3, 2]),
  level(6, '两种聊天声', '小桥想和豆豆聊天，也想与正在讲电话的阿麦分开。', 2, 3, [
    ['阿麦', tag('door')],
    ['小桥', tag('window'), apart(1)],
    ['豆豆', beside(2)],
    ['安姨', zone('back'), tag('window')]
  ], [2, 3, 4, 5]),
  level(7, '中排的画筒', '两对朋友各坐一排，把中排的空位留给画筒。', 2, 3, [
    ['叶叶', zone('front'), tag('window')],
    ['阿谷', beside(1)],
    ['石青', zone('middle'), space()],
    ['洛洛', zone('back'), tag('window')],
    ['南南', beside(4)]
  ], [1, 2, 3, 5, 6]),
  level(8, '三组同行人', '座位刚好坐满。先找到中排的搭档，再安排其他两组。', 2, 3, [
    ['阿棠', tag('window'), zone('front')],
    ['米粒', beside(1)],
    ['小北', tag('window'), not('front')],
    ['阿冬', beside(3), zone('middle')],
    ['知夏', tag('window'), apart(1)],
    ['川川', beside(5), not('door')]
  ], [1, 2, 3, 4, 5, 6]),
  level(9, '两份小小留白', '前排和中排各有人需要空位，后排的朋友正好结伴。', 2, 3, [
    ['阿黎', tag('door'), space()],
    ['可可', zone('middle'), space()],
    ['松松', tag('window'), zone('back')],
    ['小竹', beside(3), apart(2)]
  ], [2, 3, 5, 6]),
  level(10, '开往周末', '五位乘客只留一个空位。让它留在需要它的人身旁。', 2, 3, [
    ['小禾', tag('window'), beside(2)],
    ['阿朔', zone('front')],
    ['雨点', tag('window'), apart(1)],
    ['阿简', beside(3), not('door')],
    ['星子', zone('back'), space()]
  ], [1, 2, 3, 4, 6]),

  level(11, '树下开席', '两排野餐席每排三个座位：左侧树荫，右侧取餐，中间能邻接两人。', 3, 2, [
    ['小桑', tag('shade')],
    ['阿贝', beside(1)],
    ['小梨', tag('serving'), apart(1)]
  ], [1, 2, 3]),
  level(12, '花香和饭香', '第一排朝花园，第二排靠餐台。灯笼挂在第二排中间。', 3, 2, [
    ['阿芷', tag('shade'), zone('garden')],
    ['小溪', beside(1)],
    ['橙橙', zone('kitchen'), tag('shade')],
    ['阿粟', zone('kitchen'), tag('serving')]
  ], [1, 2, 4, 6]),
  level(13, '给面包篮让座', '小麦要挨着朋友坐，还想让另一侧留空。', 3, 2, [
    ['小麦', zone('garden'), space()],
    ['阿桃', beside(1)],
    ['苔苔', tag('shade'), zone('kitchen')],
    ['阿葵', tag('serving'), zone('kitchen')]
  ], [2, 1, 4, 6]),
  level(14, '夹在笑声中间', '小芽想同时挨着两位朋友。哪一个中间位还能留给她？', 3, 2, [
    ['小芽', beside(2), beside(3)],
    ['阿茉', tag('shade')],
    ['阿栗', tag('serving')],
    ['小夕', tag('lantern')],
    ['团团', beside(4), not('shade')]
  ], [2, 1, 3, 5, 6]),
  level(15, '同排也能不相邻', '花园侧两端隔着一个座位；不相邻的人也可以坐在同一排。', 3, 2, [
    ['阿蓝', zone('garden'), tag('shade')],
    ['小柚', zone('garden'), apart(1)],
    ['阿萤', tag('lantern')],
    ['月月', beside(3), not('serving')]
  ], [1, 3, 5, 4]),
  level(16, '共用一格晚风', '花园侧的两人都想邻接空位，餐台侧则要坐满。', 3, 2, [
    ['阿蒲', zone('garden'), tag('shade'), space()],
    ['小芹', zone('garden'), space()],
    ['暖暖', tag('lantern')],
    ['阿澄', beside(3), tag('shade')],
    ['蓉蓉', beside(3), tag('serving')]
  ], [1, 3, 5, 4, 6]),
  level(17, '传一盘青梅', '餐台侧需要三个人连着坐，另一排的两个人还想留一点空。', 3, 2, [
    ['阿梅', tag('lantern'), beside(2)],
    ['小枫', tag('shade')],
    ['阿泉', beside(1), not('shade')],
    ['小露', zone('garden'), space()],
    ['阿芽', zone('garden'), apart(4)]
  ], [5, 4, 6, 1, 3]),
  level(18, '餐巾的顺序', '六人满席。灯笼和花园里的树荫，是两条线索的起点。', 3, 2, [
    ['阿荷', tag('shade'), zone('garden')],
    ['小舟', beside(1), beside(3)],
    ['阿栀', not('shade')],
    ['小灯', tag('lantern')],
    ['阿棋', beside(4), not('serving')],
    ['小团', beside(4), apart(2)]
  ], [1, 2, 3, 5, 4, 6]),
  level(19, '灯下留个位置', '灯笼旁的人既要挨着朋友，也要挨着空位。', 3, 2, [
    ['阿萱', tag('lantern'), space()],
    ['小茴', beside(1), not('serving')],
    ['阿芒', tag('serving')],
    ['小晴', beside(3), apart(1)],
    ['阿榛', tag('shade'), apart(2)]
  ], [5, 4, 3, 2, 1]),
  level(20, '最后一道甜汤', '两排都坐满：一排由灯笼定中心，另一排从树荫传到取餐侧。', 3, 2, [
    ['小糯', tag('lantern'), beside(2), beside(3)],
    ['阿枣', not('serving')],
    ['小莲', apart(4)],
    ['阿茶', tag('shade'), zone('garden')],
    ['小酥', beside(4), beside(6)],
    ['阿糖', tag('serving'), apart(2)]
  ], [5, 4, 6, 1, 2, 3]),

  level(21, '银幕刚刚亮', '每排四个座位。第一排靠银幕，每排最右侧靠音箱，两端有边座标记。', 4, 2, [
    ['小影', tag('screen'), tag('left')],
    ['阿映', beside(1)],
    ['小幕', zone('rear'), not('speaker')],
    ['阿声', tag('speaker'), apart(3)]
  ], [1, 2, 5, 4]),
  level(22, '后排树影', '后排左边两个座位在树荫下。两位朋友想一起坐在那里。', 4, 2, [
    ['阿杉', tag('shade'), tag('edge')],
    ['小杉', beside(1)],
    ['阿远', tag('screen'), not('edge')],
    ['小遥', beside(3), tag('speaker')],
    ['阿羽', zone('rear'), apart(1), tag('speaker')]
  ], [5, 6, 3, 4, 8]),
  level(23, '一串爆米花', '三位朋友想连成一串，坐中间的阿米要同时挨着另外两人。', 4, 2, [
    ['阿米', tag('screen'), beside(2), beside(3)],
    ['小苞', tag('left')],
    ['阿粒', not('speaker')],
    ['小穗', zone('rear'), tag('shade'), space()],
    ['阿露', tag('speaker'), zone('rear')]
  ], [2, 1, 3, 5, 8]),
  level(24, '前排的一格空白', '前排三人中有两人需要空位，试着让同一个空位照顾他们。', 4, 2, [
    ['小帆', tag('screen'), tag('left'), space()],
    ['阿航', tag('screen'), not('edge'), space()],
    ['小港', beside(2), tag('speaker')],
    ['阿汐', zone('rear'), tag('shade')],
    ['小潮', beside(4), not('edge')],
    ['阿湾', zone('rear'), tag('speaker')]
  ], [1, 3, 4, 5, 6, 8]),
  level(25, '音箱边的搭档', '两对朋友都需要内侧座位，后排还有一位想挨着空位的观众。', 4, 2, [
    ['阿弦', tag('speaker'), tag('screen')],
    ['小音', beside(1), apart(3)],
    ['阿拍', tag('screen'), tag('left')],
    ['小调', beside(3)],
    ['阿笛', tag('shade'), tag('edge'), space()],
    ['小鼓', zone('rear'), tag('speaker')]
  ], [4, 3, 1, 2, 5, 8]),
  level(26, '后排四人组', '一条四人链要放进后排。前排的空位可以留在不同方向。', 4, 2, [
    ['小松', zone('rear'), tag('left')],
    ['阿柏', beside(1), beside(3)],
    ['小梧', beside(4), not('speaker')],
    ['阿桐', zone('rear'), tag('speaker')],
    ['小榕', tag('screen'), space()],
    ['阿槐', tag('screen'), apart(5)]
  ], [5, 6, 7, 8, 1, 4]),
  level(27, '七张电影票', '只有一个空位：先安顿树影下的两个人，再考虑前排的四位朋友。', 4, 2, [
    ['阿星', tag('screen'), tag('left')],
    ['小月', beside(1), beside(3)],
    ['阿辰', beside(4), not('edge')],
    ['小晖', tag('screen'), tag('speaker')],
    ['阿夜', tag('shade'), tag('edge')],
    ['小晚', beside(5), space()],
    ['阿暮', zone('rear'), tag('speaker')]
  ], [1, 2, 3, 4, 5, 6, 8]),
  level(28, '同一片空座', '后排两个人都想邻接空位，其中一位还想挨着朋友。', 4, 2, [
    ['小墨', zone('rear'), tag('left'), space()],
    ['阿砚', zone('rear'), not('edge'), space(), beside(3)],
    ['小宣', tag('speaker')],
    ['阿笔', tag('screen'), tag('left')],
    ['小书', beside(4), beside(6)],
    ['阿页', not('speaker')],
    ['小笺', tag('screen'), tag('speaker')]
  ], [5, 7, 8, 1, 2, 3, 4]),
  level(29, '满场之前', '八人全部入座。两条朋友链从左端展开，注意谁不能挨着谁。', 4, 2, [
    ['阿晨', tag('screen'), tag('left')],
    ['小曦', beside(1), beside(3)],
    ['阿曜', beside(4)],
    ['小灿', tag('speaker'), apart(2)],
    ['阿宁', tag('shade'), tag('edge')],
    ['小静', beside(5), beside(7)],
    ['阿悠', not('speaker'), apart(1)],
    ['小然', beside(7), tag('speaker')]
  ], [1, 2, 3, 4, 5, 6, 7, 8]),
  level(30, '星光留给大家', '两个空位需求、两组同行人，只有一格能留空。先找出它该在哪一排。', 4, 2, [
    ['小禾', tag('screen'), tag('left'), beside(2)],
    ['阿朔', not('edge'), space()],
    ['雨点', tag('speaker'), space()],
    ['阿简', tag('shade'), tag('edge')],
    ['星子', beside(4), beside(6)],
    ['小糯', not('speaker'), beside(7)],
    ['阿茶', zone('rear'), apart(5)]
  ], [1, 2, 4, 5, 6, 7, 8])
];

module.exports = { levels, chapters };
