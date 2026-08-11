export type Market = { key:string; label:string; ticker:string; group:'INDEX'|'SECTOR'|'METAL' };

export const market: Market[] = [
  {key:'NIFTY50',label:'Nifty 50',ticker:'^NSEI',group:'INDEX'},
  {key:'NIFTYNEXT50',label:'Nifty Next 50',ticker:'^NSMIDCP',group:'INDEX'},
  {key:'NIFTYMIDCAP150',label:'Nifty Midcap 150',ticker:'NIFTYMIDCAP150.NS',group:'INDEX'},
  {key:'NIFTY_SMLCAP250',label:'Nifty Smallcap 250',ticker:'NIFTYSMLCAP250.NS',group:'INDEX'},
  {key:'NIFTY_LARGEMID250',label:'Nifty LargeMidcap 250',ticker:'NIFTY_LARGEMID250.NS',group:'INDEX'},
  {key:'NIFTY500',label:'Nifty 500',ticker:'^CRSLDX',group:'INDEX'},
  {key:'NIFTYINFRA',label:'Nifty Infrastructure',ticker:'^CNXINFRA',group:'SECTOR'},
  {key:'NIFTY_FIN_SERVICE',label:'Nifty Financial Services',ticker:'NIFTY_FIN_SERVICE.NS',group:'SECTOR'},
  {key:'NIFTYPHARMA',label:'Nifty Pharma',ticker:'^CNXPHARMA',group:'SECTOR'},
  {key:'NIFTYIT',label:'Nifty IT',ticker:'^CNXIT',group:'SECTOR'},
  {key:'NIFTYSERVSECTOR',label:'Nifty Services',ticker:'NIFTYSERVSECTOR.NS',group:'SECTOR'},
  {key:'NIFTYAUTO',label:'Nifty Auto',ticker:'^CNXAUTO',group:'SECTOR'},
  {key:'NIFTYMETAL',label:'Nifty Metal',ticker:'^CNXMETAL',group:'SECTOR'},
  {key:'NIFTYREALTY',label:'Nifty Realty',ticker:'^CNXREALTY',group:'SECTOR'},
  {key:'NIFTYENERGY',label:'Nifty Energy',ticker:'^CNXENERGY',group:'SECTOR'},
  {key:'NIFTYCONSUMPTION',label:'Nifty Consumption',ticker:'^CNXCONSUM',group:'SECTOR'},
];
