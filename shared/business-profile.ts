/** ISO 7064 MOD 11,10 checksum for Croatian OIB. */
export function isValidOib(value:string){
  if(!/^\d{11}$/.test(value))return false
  let a=10
  for(let i=0;i<10;i++){a=(a+Number(value[i]))%10;if(a===0)a=10;a=(a*2)%11}
  return (11-a)%10===Number(value[10])
}
