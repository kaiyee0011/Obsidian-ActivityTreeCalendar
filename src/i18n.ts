import { moment } from 'obsidian';

export interface ActivityMessages {
	viewName: string;
	openView: string;
	previousMonth: string;
	nextMonth: string;
	weekLabel: string;
	weekdays: readonly string[];
	monthFormat: string;
	dayFormat: string;
	emptyDay: string;
	settingsTitle: string;
	maxHeatFilesName: string;
	maxHeatFilesDescription: string;
	weekNumber: (week: number) => string;
	dayActivity: (date: string, count: number) => string;
}

const ZH_CN: ActivityMessages = {
	viewName: '活动日历',
	openView: '打开活动日历',
	previousMonth: '上一个月',
	nextMonth: '下一个月',
	weekLabel: '周',
	weekdays: ['一', '二', '三', '四', '五', '六', '日'],
	monthFormat: 'YYYY 年 M 月',
	dayFormat: 'M 月 D 日',
	emptyDay: '当天没有编辑记录',
	settingsTitle: '活动日历',
	maxHeatFilesName: '最深热力阈值',
	maxHeatFilesDescription: '一天编辑的文件数达到此值时显示最深色。默认值为 10。',
	weekNumber: (week) => `第 ${week} 周`,
	dayActivity: (date, count) => `${date}，编辑过 ${count} 个文件`,
};

const EN: ActivityMessages = {
	viewName: 'Activity calendar',
	openView: 'Open activity calendar',
	previousMonth: 'Previous month',
	nextMonth: 'Next month',
	weekLabel: 'W',
	weekdays: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
	monthFormat: 'MMMM YYYY',
	dayFormat: 'MMMM D',
	emptyDay: 'No edited files on this day',
	settingsTitle: 'Activity calendar',
	maxHeatFilesName: 'Darkest heat threshold',
	maxHeatFilesDescription: 'Use the darkest shade when this many files are edited in one day. Default: 10.',
	weekNumber: (week) => `Week ${week}`,
	dayActivity: (date, count) =>
		`${date}, ${count} edited ${count === 1 ? 'file' : 'files'}`,
};

export function getMessages(): ActivityMessages {
	return moment.locale().toLowerCase().startsWith('zh') ? ZH_CN : EN;
}
