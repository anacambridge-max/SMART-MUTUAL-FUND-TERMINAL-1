export type Fund = {
  code: string;
  name: string;
  category: string;
  proxy: string;
  proxyLabel: string;
};

export const funds: Fund[] = [
  ['120843','Quant Flexi Cap Fund Direct Growth','Flexi Cap','NIFTY500','Nifty 500'],
  ['120826','Quant Large and Mid Cap Fund Direct Growth','Large & Mid Cap','NIFTY_LARGEMID250','Nifty LargeMidcap 250'],
  ['120821','Quant Multi Asset Fund Direct Growth','Multi Asset','NIFTY500','Nifty 500'],
  ['120823','Quant Multi Cap Fund Direct Growth','Multi Cap','NIFTY500','Nifty 500'],
  ['120833','Quant Infrastructure Fund Direct Growth','Infrastructure','NIFTYINFRA','Nifty Infrastructure'],
  ['151791','Quant BFSI Fund Direct Growth','BFSI','NIFTY_FIN_SERVICE','Nifty Financial Services'],
  ['119827','SBI Nifty 50 Index Fund Direct Growth','Nifty 50 Index','NIFTY50','Nifty 50'],
  ['119783','SBI Healthcare Opportunities Fund Direct Growth','Healthcare','NIFTYPHARMA','Nifty Pharma'],
  ['119727','SBI Focused Equity Fund Direct Growth','Focused Equity','NIFTY500','Nifty 500'],
  ['148490','SBI Children’s Benefit Fund Direct Growth','Children','NIFTY500','Nifty 500'],
  ['147946','Bandhan Small Cap Fund Direct Growth','Small Cap','NIFTY_SMLCAP250','Nifty Smallcap 250'],
  ['118989','HDFC Mid Cap Opportunities Fund Direct Growth','Mid Cap','NIFTYMIDCAP150','Nifty Midcap 150'],
  ['143341','UTI Nifty Next 50 Index Fund Direct Growth','Nifty Next 50 Index','NIFTYNEXT50','Nifty Next 50'],
  ['150714','UTI Gold ETF FoF Direct Growth','Gold','GOLD','Gold'],
  ['125497','SBI Small Cap Fund Direct Growth','Small Cap','NIFTY_SMLCAP250','Nifty Smallcap 250'],
  ['120586','ICICI Prudential Value Discovery Fund Direct Growth','Value','NIFTY500','Nifty 500'],
  ['120503','Axis ELSS Tax Saver Fund Direct Growth','ELSS','NIFTY500','Nifty 500'],
  ['144835','Sundaram Services Fund Direct Growth','Services','NIFTYSERVSECTOR','Nifty Services'],
  ['135800','Tata Digital India Fund Direct Growth','Digital / IT','NIFTYIT','Nifty IT'],
].map(([code,name,category,proxy,proxyLabel]) => ({code,name,category,proxy,proxyLabel}));

export const fundCodes = funds.map(f => f.code);
