// Estimativas em dias úteis: sábados e domingos excluídos; feriados exigem tabela logística posterior.
export function addBusinessDays(when,days){const date=new Date(when);if(Number.isNaN(date.getTime())||!Number.isInteger(days)||days<0)return null;let remaining=days;while(remaining>0){date.setUTCDate(date.getUTCDate()+1);if(date.getUTCDay()!==0&&date.getUTCDay()!==6)remaining--}return date}
export function isPostingLate(paidAt,preparationDays,postedAt=null,now=new Date()){
 if(!paidAt||postedAt)return false;const deadline=addBusinessDays(paidAt,preparationDays);return deadline!==null&&new Date(now)>deadline;
}
