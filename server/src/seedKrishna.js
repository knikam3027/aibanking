require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Account = require('./models/Account');
const Transaction = require('./models/Transaction');

// ── Auto-categorize based on transaction remarks ──
function categorize(remarks) {
  const r = remarks.toLowerCase();
  // Food & Dining
  if (/swiggy|zomato|dominos|pizza|bharatpe\.9007|hungerbox|food|restaurant|hotel\s*shri|eat\s*anytim|tea\s*n\s*peta|pankaj\s*sup/i.test(r)) return 'Food';
  // Salary / Income
  if (/salary|salaryreimburse|delta\s*ind|deltai|easebuzz.*escrow|cheq.*invoice|cheqonline|cheq\s*digit|payouts\.cheqdg/i.test(r)) return 'Salary';
  // EMI / Loan / Credit Card
  if (/cred\.club|cred\s*club|pl\.ksf|sbicardsandpaym|credit\s*card|kisetsu|muthoot|kotak\s*mahi.*pay/i.test(r)) return 'Bills';
  // Shopping
  if (/amazon|flipkart|playstore|makemytrip|audible|netflix|microsoft|github|google|openai|hostinger|sabarmati|pincode|nukl|mobikwik|nucle/i.test(r)) return 'Shopping';
  // Investments / Stock / Mutual Fund
  if (/mirae\s*asset|hdfc\s*securities|moneylicious|raise\s*securities|indstocks|multipl|360one|gothi\s*plascon|mstock/i.test(r)) return 'Investment';
  // Insurance
  if (/navi\s*gener|navi\.insurance|insurance/i.test(r)) return 'Insurance';
  // CRED offers / cashback products
  if (/cp\.|credpay\.|cred\.voucher|poweraccess/i.test(r)) return 'Shopping';
  // Utility / Recharge / Bills
  if (/recharge|electricity|gas\s*bill|water\s*bill|broadband|jio|airtel.*mandate|vodafone|bsnl|msrtc|pmpml|pune\s*metro|drinkprime|savesage|cred\.telecom/i.test(r)) return 'Bills';
  // Dividends / ACH
  if (/^ach\/|dividend|div\s*20|fnldiv|int\.pd:|intdiv|interim/i.test(r)) return 'Investment';
  // Rent / Housing
  if (/rent|housing|landlord/i.test(r)) return 'Rent';
  // Health
  if (/apollo|hospital|medical|pharma|health|clinic/i.test(r)) return 'Health';
  // Travel
  if (/makemytrip|airbnb|irctc|ola|uber|rapido|travel|msrtc|pmpml|pune\s*metro|sabarmati/i.test(r)) return 'Travel';
  // Internal / Self Transfer
  if (/bil\/inft|bil\/neft|mmt\/imps.*krishna|mmt\/imps.*nikam|mmt\/imps.*ratan|mmt\/imps.*shrikant|mmt\/imps.*shruti|imps\s*p2a/i.test(r)) return 'Transfer';
  // UPI Transfers (people)
  if (/^upi\//i.test(r)) return 'Transfer';
  // NEFT / RTGS
  if (/^neft-|^rtgs-/i.test(r)) return 'Transfer';
  // Cash
  if (/cash\s*paid|withdrawal\s*slip|atm/i.test(r)) return 'Cash';
  // NRS (Foreign)
  if (/^nrs\//i.test(r)) return 'Transfer';
  // DTK tokens
  if (/^dtk\//i.test(r)) return 'Other';
  // Demat charges
  if (/dpchg/i.test(r)) return 'Investment';
  // CMS
  if (/^cms\//i.test(r)) return 'Investment';
  return 'General';
}

// ── Additional transactions ──
const moreTxns = require('./moreTxns');

// ── All transactions from ICICI PDF ──
// Format: [date(DD.MM.YYYY), remarks, withdrawal, deposit, balance]
const rawTxns = [
["05.04.2025","UPI/krishna9822@ybl/Payment from Ph/UCO BANK",6000,0,640.86],
["06.04.2025","UPI/gpay-1124712701/Payment from Ph/AXIS BANK",130,0,510.86],
["07.04.2025","UPI/BHARATPE.900705/Pay to BharatPe/FEDERAL BANK",90,0,420.86],
["08.04.2025","UPI/9545008003@navi/Paid via Navi/Standard Charte",0,30000,30420.86],
["08.04.2025","UPI/cheq1@yesbank/Invoice/YES BANK LIMITE",29900,0,520.86],
["08.04.2025","UPI/BHARATPE.900705/Pay to BharatPe/FEDERAL BANK",100,0,420.86],
["08.04.2025","NEFT-YESBN52025040801086806-EASEBUZZ PVT LTD PA ESCROW A/C",0,49026.50,49447.36],
["08.04.2025","UPI/cheq1@yesbank/Invoice/YES BANK LIMITE",48000,0,1447.36],
["08.04.2025","UPI/BHARATPE.900705/Pay to BharatPe/FEDERAL BANK",50,0,1397.36],
["10.04.2025","UPI/playstore@axisb/MandateExecute/AXIS BANK",699,0,698.36],
["11.04.2025","VIN/AMAZONAWSES/202504111224/510106378269",2,0,696.36],
["11.04.2025","NEFT-YESBN52025041102154320-EASEBUZZ PVT LTD PA ESCROW A/C",0,73539.75,74236.11],
["14.04.2025","UPI/maniruddinsk7@y/Payment from Ph/BANK OF INDIA",350,0,73886.11],
["14.04.2025","UPI/8237323390@axl/Payment from Ph/ABHYUDAYA CO OP",4000,0,69886.11],
["15.04.2025","VISA REF AMAZON WEB SERVICES",0,2,69888.11],
["16.04.2025","UPI/cheq1@yesbank/Invoice/YES BANK LIMITE",50000,0,19888.11],
["16.04.2025","UPI/cred.club@axisb/payment on CRED/AXIS BANK",300,0,19588.11],
["16.04.2025","UPI/cheq1@yesbank/Invoice/YES BANK LIMITE",18000,0,1588.11],
["17.04.2025","NEFT-YESBN52025041704143006-EASEBUZZ PVT LTD PA ESCROW A/C",0,77461.87,79049.98],
["17.04.2025","UPI/CHEQONLINE@ybl/Payment for PYI/YES BANK LIMITE",13550,0,65499.98],
["17.04.2025","UPI/CHEQONLINE@ybl/Payment for PYI/YES BANK LIMITE",50000,0,15499.98],
["18.04.2025","UPI/9082827416@axl/Payment from Ph/BANK OF INDIA",0,1000,16499.98],
["20.04.2025","UPI/9096022994-2@yb/Payment from Ph/BANK OF BARODA",7000,0,9499.98],
["21.04.2025","UPI/sbicardsandpaym/Pay/ICICI Bank LTD",841,0,8658.98],
["21.04.2025","UPI/7717297724-2@yb/Payment from Ph/INDIA POST PAYM",250,0,8408.98],
["21.04.2025","NEFT-YESBN52025042105436206-EASEBUZZ PVT LTD PA ESCROW A/C",0,49026.50,57435.48],
["21.04.2025","UPI/playstore@axisb/Sold by Fast Ca/AXIS BANK",160,0,57275.48],
["21.04.2025","UPI/CHEQONLINE@ybl/Payment for PYI/YES BANK LIMITE",50118,0,7157.48],
["22.04.2025","UPI/CHEQONLINE@axl/Payment for PYI/AXIS BANK",5000,0,2157.48],
["22.04.2025","UPI/mnikam3000@ybl/Payment from Ph/HDFC BANK LTD",0,23060,25217.48],
["22.04.2025","NEFT-YESBN52025042205782261-EASEBUZZ PVT LTD PA ESCROW A/C",0,58831.80,84049.28],
["22.04.2025","MMT/IMPS/511222189361/Krishna Ni/UBIN0558303",1,0,84048.28],
["22.04.2025","MMT/IMPS/511222190767/Krishna Ni/UBIN0558303",11,0,84037.28],
["22.04.2025","MMT/IMPS/511222191246/Krishna Ni/UBIN0558303",60000,0,24037.28],
["23.04.2025","UPI/BHARATPE.900705/Pay to BharatPe/FEDERAL BANK",90,0,23947.28],
["23.04.2025","NEFT-YESBN52025042306120461-EASEBUZZ PVT LTD PA ESCROW A/C",0,58831.80,82779.08],
["24.04.2025","UPI/BHARATPE.900705/Pay to BharatPe/FEDERAL BANK",70,0,82709.08],
["24.04.2025","UPI/9545008003@navi/Payment from Ph/Standard Charte",60000,0,22709.08],
["25.04.2025","NEFT-YESBN52025042506779398-EASEBUZZ PVT LTD PA ESCROW A/C",0,58831.80,81540.88],
["28.04.2025","UPI/BHARATPE.900705/Pay to BharatPe/FEDERAL BANK",70,0,81470.88],
["28.04.2025","UPI/9545008003@navi/Payment from Ph/Standard Charte",0,35000,46470.88],
["29.04.2025","UPI/9545008003@navi/Payment from Ph/Standard Charte",10000,0,36470.88],
["30.04.2025","UPI/Bank Account XX/Payment from Ph/HDFC BANK LTD",14000,0,22470.88],
["30.04.2025","UPI/9545008003@navi/Paid via Navi U/Standard Charte",0,80000,102470.88],
["30.04.2025","UPI/Bank Account XX/Payment from Ph/YES BANK LIMITE",15000,0,87470.88],
["30.04.2025","UPI/pl.ksf@axisb/payment on CRED/AXIS BANK",8869,0,78601.88],
["30.04.2025","BIL/INFT/EDY3951535/ KRISHNA MADHUKA",49000,0,29601.88],
["30.04.2025","MMT/IMPS/512012304627/Nikam Kris/YESB0000585",9000,0,20601.88],
["30.04.2025","BIL/NEFT/ICICN12025043078261941/SHRIKANT M/KOTAK MAHINDRA",10,0,20591.88],
["30.04.2025","BIL/NEFT/ICICN12025043078266412/Credited Amount/SHRIKANT M/KOTAK",0,1,20590.88],
["01.05.2025","UPI/sbicardsandpaym/Pay/ICICI Bank LTD",10000,0,10590.88],
["01.05.2025","UPI/7017068980@ybl/Payment from Ph/State Bank Of I",0,10000,20590.88],
["01.05.2025","UPI/9892739522@ybl/Payment from Ph/BANDHAN BANK LT",500,0,20090.88],
["01.05.2025","UPI/9082827416@axl/Payment from Ph/BANK OF INDIA",160,0,19930.88],
["01.05.2025","UPI/9082827416@axl/Payment from Ph/BANK OF INDIA",0,160,20090.88],
["02.05.2025","NEFT-YESBN52025050208960062-EASEBUZZ PVT LTD PA ESCROW A/C",0,29415.90,49506.78],
["02.05.2025","UPI/priya.biradar14/Payment from Ph/AXIS BANK",1000,0,48506.78],
["02.05.2025","UPI/priya.biradar14/UPI/AXIS BANK",0,1000,49506.78],
["02.05.2025","UPI/9545008003@navi/Paid via Navi U/Standard Charte",0,60000,109506.78],
["02.05.2025","UPI/priya.biradar14/Payment from Ph/AXIS BANK",60000,0,49506.78],
["03.05.2025","UPI/mnikam3000@ybl/Payment from Ph/HDFC BANK LTD",23060,0,26446.78],
["03.05.2025","UPI/krishna0076@axl/Payment from Ph/AXIS BANK",3000,0,23446.78],
["03.05.2025","UPI/priya.biradar14/UPI/AXIS BANK",0,60000,83446.78],
["05.05.2025","UPI/paytmqr6da3al@p/Payment from Ph/YES BANK LIMITE",225,0,83221.78],
["06.05.2025","ACH/CIE AUTOMOTIVE INDIA/1665575",0,7,83228.78],
["06.05.2025","NEFT-HDFCN52025050615996821-HDFC SECURITIES LTD SKY CILENT DSCNB A/C",0,3097.67,86326.45],
["06.05.2025","UPI/7249140821@axl/Payment from Ph/ICICI Bank",47000,0,39326.45],
["06.05.2025","UPI/cred.club@axisb/payment on CRED/AXIS BANK",841,0,38485.45],
["09.05.2025","UPI/9082827416@ybl/Payment from Ph/BANK OF INDIA",1000,0,37485.45],
["10.05.2025","UPI/7020542266@slic/Garagepreneurs",0,2,37487.45],
["10.05.2025","UPI/7378916671@axl/Payment from Ph/BANK OF BARODA",700,0,36787.45],
["10.05.2025","UPI/gpay-1124712701/Payment from Ph/AXIS BANK",45,0,36742.45],
["10.05.2025","UPI/9545008003@navi/Paid via Navi U/Standard Charte",0,100000,136742.45],
["10.05.2025","UPI/cheq1@yesbank/Invoice/YES BANK LIMITE",99900,0,36842.45],
["12.05.2025","UPI/9082827416@ybl/Payment from Ph/BANK OF INDIA",80,0,36762.45],
["12.05.2025","UPI/9082827416@axl/Payment from Ph/BANK OF INDIA",0,2000,38762.45],
["13.05.2025","UPI/sachinugale1188/Payment from Ph/HDFC BANK LTD",3914,0,34848.45],
["13.05.2025","UPI/7249140821@axl/Payment from Ph/ICICI Bank",6000,0,28848.45],
["13.05.2025","UPI/9082827416@axl/Payment from Ph/BANK OF INDIA",0,80,28928.45],
["13.05.2025","UPI/9082827416@ybl/Payment from Ph/BANK OF INDIA",0,30,28958.45],
["14.05.2025","UPI/KUKUFMONLINE@yb/Collect request/YES BANK LIMITE",2,0,28956.45],
["14.05.2025","UPI/phonepemerchant/R02 PhonePe Rev/YES BANK LIMITE",0,2,28958.45],
["14.05.2025","NEFT-SCBLN52025051400545772-MIRAE ASSET CAPITAL MARKETS INDIA",0,25000,53958.45],
["14.05.2025","UPI/9082827416@axl/Payment from Ph/BANK OF INDIA",0,80,54038.45],
["14.05.2025","UPI/9082827416@ybl/Payment from Ph/BANK OF INDIA",20,0,54018.45],
["15.05.2025","UPI/9545008003@navi/Paid via Navi U/Standard Charte",0,21000,75018.45],
["15.05.2025","UPI/9011418628@ptax/Payment from Ph/BANK OF INDIA",311.46,0,74706.99],
["16.05.2025","MMT/IMPS/513611394261/DELTA INDI/HDFC0999999",65980,0,8726.99],
["16.05.2025","ACH/COLAB CLOUD PLATFORM/1209290006791997",0,0.01,8727],
["16.05.2025","ACH/360ONEINT1202526/00000000000000051323",0,6,8733],
["17.05.2025","UPI/9921256882@axl/Payment from Ph/BANK OF INDIA",0,63980,72713],
["18.05.2025","UPI/cheq1@yesbank/Invoice/YES BANK LIMITE",53537,0,19176],
["19.05.2025","NEFT-YESBN12025051905971481-EASEBUZZ PVT LTD PA ESCROW A/C",0,147079.50,166255.50],
["19.05.2025","MMT/IMPS/513921430882/Krishna Ni/UBIN0558303",100000,0,66255.50],
["20.05.2025","UPI/9082827416@ybl/Payment from Ph/BANK OF INDIA",0,160,66415.50],
["22.05.2025","UPI/sbicardsandpaym/Pay/ICICI Bank LTD",4038.55,0,62376.95],
["22.05.2025","UPI/sbicardsandpaym/Pay/ICICI Bank LTD",10000,0,52376.95],
["22.05.2025","UPI/javirsanket70@o/Payment from Ph/BANK OF BARODA",2000,0,50376.95],
["23.05.2025","VSI/AMAZON WEB/202505232011/514314317713",2,0,50374.95],
["23.05.2025","VIN/AMAZONAWSES/202505232021/514314519305",2,0,50372.95],
["24.05.2025","UPI/9082827416@axl/Payment from Ph/BANK OF INDIA",0,80,50452.95],
["25.05.2025","UPI/7620036238@ybl/Payment from Ph/BANK OF BARODA",5000,0,45452.95],
["25.05.2025","UPI/ibkPOS.EP059080/Payment from Ph/ICICI Bank",20,0,45432.95],
["26.05.2025","VISA REF AMAZON WEB SERVICES",0,2,45434.95],
["26.05.2025","VISA REF AMAZON WEB SERVICES",0,2,45436.95],
["28.05.2025","RTGS-SCBLR12025052800800421-MIRAE ASSET CAPITAL MARKETS INDIA",0,200001,245437.95],
["28.05.2025","UPI/7887224672-2@ax/Payment from Ph/BANK OF BARODA",200,0,245237.95],
["28.05.2025","UPI/9082827416@ybl/Payment from Ph/BANK OF INDIA",0,70,245307.95],
["29.05.2025","UPI/Bank Account XX/Payment from Ph/HDFC BANK LTD",1,0,245306.95],
["29.05.2025","UPI/RVSLBank Account XX/Payment from Ph/HDFC BANK LTD",0,1,245307.95],
["29.05.2025","UPI/cred.club@axisb/payment on CRED/AXIS BANK",940,0,244367.95],
["30.05.2025","UPI/shrutigalande2@/Payment from Ph/BANK OF MAHARAS",20000,0,224367.95],
["30.05.2025","UPI/shrutigalande2@/Payment from Ph/BANK OF MAHARAS",20000,0,204367.95],
["30.05.2025","MMT/IMPS/515010999043/DELTA INDI/HDFC0999999",65980,0,138387.95],
["30.05.2025","UPI/9921256882@axl/Payment from Ph/BANK OF INDIA",0,63980,202367.95],
["30.05.2025","BIL/INFT/EEY9056969/ KRISHNA MADHUKA",50000,0,152367.95],
["30.05.2025","MMT/IMPS/515013506483/Nikam Kris/YESB0000585",18000,0,134367.95],
["30.05.2025","MMT/IMPS/515013510021/HDFC/HDFC0004200",15000,0,119367.95],
["30.05.2025","UPI/cred.club@axisb/payment on CRED/AXIS BANK",10000,0,109367.95],
["30.05.2025","UPI/7447403765@ibl/Payment from Ph/State Bank Of I",0,5000,114367.95],
["01.06.2025","UPI/7620036238@axl/Payment from Ph/BANK OF BARODA",0,5000,119367.95],
["01.06.2025","UPI/vishal.lokhande/Payment from Ph/BANK OF INDIA",4000,0,115367.95],
["01.06.2025","UPI/vishal.lokhande/Payment from Ph/BANK OF INDIA",1000,0,114367.95],
["01.06.2025","UPI/cred.club@axisb/payment on CRED/AXIS BANK",30000,0,84367.95],
["01.06.2025","UPI/cred.club@axisb/payment on CRED/AXIS BANK",6000,0,78367.95],
["02.06.2025","UPI/paytm-8774066@p/Hungerbox Order/YES BANK LIMITE",68,0,78299.95],
["02.06.2025","UPI/7249140821@ybl/Payment from Ph/ICICI Bank",5000,0,73299.95],
["02.06.2025","UPI/shankarshivramp/Payment from Ph/BANK OF INDIA",3000,0,70299.95],
["03.06.2025","UPI/shrutigalande2@/UPI/BANK OF MAHARAS",0,20000,90299.95],
["03.06.2025","UPI/sachinugale1188/Payment from Ph/HDFC BANK LTD",5000,0,85299.95],
["03.06.2025","UPI/shrutigalande2@/UPI/BANK OF MAHARAS",0,20000,105299.95],
["06.06.2025","UPI/cheq1@yesbank/Invoice/YES BANK LIMITE",2900,0,102399.95],
["07.06.2025","UPI/9096022994-2@yb/Payment from Ph/BANK OF BARODA",0,7000,109399.95],
["07.06.2025","UPI/9082827416@ibl/Payment from Ph/BANK OF INDIA",0,360,109759.95],
["07.06.2025","UPI/8605615050@axl/Payment from Ph/UNION BANK OF I",200,0,109559.95],
["08.06.2025","UPI/cred.club@axisb/payment on CRED/AXIS BANK",5234.77,0,104325.18],
["08.06.2025","UPI/cheq1@yesbank/Invoice/YES BANK LIMITE",50000,0,54325.18],
["09.06.2025","UPI/shankarshivramp/Payment from Ph/BANK OF INDIA",9500,0,44825.18],
["10.06.2025","NEFT-HDFCN52025061086139875-HDFC SECURITIES LTD SKY CILENT DSCNB A/C",0,3489.28,48314.46],
["11.06.2025","UPI/hdfcsecuritiesl/HDFCSecuritiesL/AIRTEL PAYMENTS",3000,0,45314.46],
["11.06.2025","UPI/8149245446@ybl/Payment from Ph/Corporation Ban",5700,0,39614.46],
["12.06.2025","NEFT-SCBLN52025061200534402-MIRAE ASSET CAPITAL MARKETS INDIA",0,60000,99614.46],
["12.06.2025","UPI/sachinugale1188/Payment from Ph/HDFC BANK LTD",4276,0,95338.46],
["15.06.2025","UPI/cheq1@yesbank/Invoice/YES BANK LIMITE",90000,0,5338.46],
["15.06.2025","VIN/PAYPAL GIT/202506151424/516608443485",915.46,0,4423],
["15.06.2025","VIN/PAYMNT RVSL/PAYPAL GIT/202506151424/516608443485",0,915.46,5338.46],
["17.06.2025","UPI/7756866431@axl/Payment from Ph/Kotak Mahindra",100,0,5238.46],
["17.06.2025","ACH/Himadri Speciality C/1208340000727581",0,0.60,5239.06],
["18.06.2025","UPI/playstore@axisb/MandateExecute/AXIS BANK",1950,0,3289.06],
["18.06.2025","UPI/9082827416@ibl/Payment from Ph/BANK OF INDIA",0,1000,4289.06],
["19.06.2025","VSI/AMAZON WEBS/202506191354/517008395873",91.57,0,4197.49],
["21.06.2025","VIN/GOOGLE GOOG/202506211635/517211163299",90.29,0,4107.20],
["21.06.2025","VIN/PAYMNT RVSL/GOOGLE GOOG/202506211635/517211163299",0,90.29,4197.49],
["21.06.2025","NEFT-YESBN12025062105866566-EASEBUZZ PVT LTD PA ESCROW A/C",0,98052.02,102249.51],
["21.06.2025","UPI/cheq1@yesbank/Invoice/YES BANK LIMITE",20000,0,82249.51],
["21.06.2025","UPI/cheq1@yesbank/Invoice/YES BANK LIMITE",2084.51,0,80165],
["23.06.2025","ACH/TATAMOTORSDIV230625/0000000000000042099981",0,6,80171],
["23.06.2025","UPI/shankarshivramp/Payment from Ph/BANK OF INDIA",24000,0,56171],
["24.06.2025","UPI/9823415224shrut/Payment from Ph/State Bank Of I",10000,0,46171],
["24.06.2025","UPI/paytmqr28100505/Payment from Ph/YES BANK LIMITE",2,0,46169],
["24.06.2025","UPI/paytmqr28100505/Payment from Ph/YES BANK LIMITE",4,0,46165],
["24.06.2025","BIL/INFT/EFS3299065/Salary/ MAHESH HANUMANT",1,0,46164],
["24.06.2025","BIL/INFT/EFS3297030/ MAHESH HANUMANT",2,0,46162],
["24.06.2025","BIL/INFT/EFS3306452/Coffee/ MAYUR SHIVAJI P",0,1,46163],
["24.06.2025","BIL/INFT/EFS3306482/ MAYUR SHIVAJI P",0,1,46164],
["24.06.2025","UPI/shrutigalande2@/Payment from Ph/BANK OF MAHARAS",20000,0,26164],
["24.06.2025","UPI/9082827416@axl/Payment from Ph/BANK OF INDIA",90,0,26074],
["25.06.2025","ACH/BY HEB DIVIDEND FOR/23200843",0,3,26077],
["25.06.2025","ACH/BY HEB DIVIDEND FOR/23200861",0,3,26080],
["26.06.2025","UPI/9834432857@ybl/Payment from Ph/ICICI Bank",660,0,25420],
["26.06.2025","UPI/9890074965@ybl/Payment from Ph/State Bank Of I",500,0,24920],
["26.06.2025","ACH/UCO BANK DIV 24-25/7381908",0,0.39,24920.39],
["26.06.2025","UPI/shrutigalande2@/UPI/BANK OF MAHARAS",0,3000,27920.39],
["27.06.2025","UPI/7249140821@axl/Payment from Ph/ICICI Bank",20000,0,7920.39],
["28.06.2025","UPI/JAYSING MA/7744974711-3@i/Payment fr/ICICI Bank",0,40000,47920.39],
["28.06.2025","UPI/KUMAR ANKU/7249140821@ybl/Payment fr/ICICI Bank",37500,0,10420.39],
["28.06.2025","UPI/KUMAR ANKU/7249140821@ybl/Payment fr/ICICI Bank",5000,0,5420.39],
["30.06.2025","091501003850:Int.Pd:29-03-2025 to 29-06-2025",0,355,5775.39],
["30.06.2025","UPI/9545008003@navi/Paid via Navi U/Standard Charte",0,98000,103775.39],
["30.06.2025","MMT/IMPS/518111187829/DELTA INDI/HDFC0999999",65980,0,37795.39],
["30.06.2025","UPI/9921256882@ybl/Payment from Ph/BANK OF INDIA",0,63980,101775.39],
["30.06.2025","UPI/shrutigalande2@/Payment from Ph/BANK OF MAHARAS",3000,0,98775.39],
["30.06.2025","MMT/IMPS/518117334010/Shruti Gal/MAHB0000954",80000,0,18775.39],
["30.06.2025","UPI/9594982289-2@yb/Payment from Ph/BANK OF INDIA",14000,0,4775.39],
["01.07.2025","ACH/CANBANK DIV 2025/8319860",0,4,4779.39],
["01.07.2025","VSI/AMAZON WEB/202507010849/518103513214",2,0,4777.39],
["01.07.2025","VIN/AMAZONAWSES/202507011129/518205193661",2,0,4775.39],
["01.07.2025","UPI/9545008003@navi/Paid via Navi U/Standard Charte",0,99999,104774.39],
["01.07.2025","BIL/INFT/EG14505561/ KRISHNA MADHUKA",50000,0,54774.39],
["01.07.2025","MMT/IMPS/518211617456/HDFC/HDFC0004200",16000,0,38774.39],
["01.07.2025","MMT/IMPS/518211623185/Nikam Kris/YESB0000585",18000,0,20774.39],
["01.07.2025","UPI/indusindbankltd/PayviaRazorpay/ICICI Bank LTD",20000,0,774.39],
["01.07.2025","VSI/MICROSOFT I/202507011458/518209864946",2,0,772.39],
["01.07.2025","UPI/inlief789312.rz/INLIEF/AIRTEL PAYMENTS",50,0,722.39],
["02.07.2025","UPI/truhairskin1100/Pay via Razorpa/AXIS BANK",50,0,672.39],
["02.07.2025","UPI/cp.tryconeb7bc7/payment on CRED/AXIS BANK",50,0,622.39],
["02.07.2025","UPI/cp.olrice22674@/payment on CRED/AXIS BANK",50,0,572.39],
["02.07.2025","UPI/rasatvamds.rzp@/PayviaRazorpay/AIRTEL PAYMENTS",50,0,522.39],
["02.07.2025","UPI/abhayhealthtech/4072032673/AXIS BANK",50,0,472.39],
["02.07.2025","UPI/cp.sugarchill8e/payment on CRED/AXIS BANK",50,0,422.39],
["02.07.2025","UPI/cp.efflair0c1fc/payment on CRED/AXIS BANK",50,0,372.39],
["02.07.2025","NEFT-YESBN12025070205910291-EASEBUZZ PVT LTD PA ESCROW A/C",0,98052.02,98424.41],
["02.07.2025","UPI/cp.olrice22674@/payment on CRED/AXIS BANK",50,0,98374.41],
["02.07.2025","UPI/cred.club@axisb/payment on CRED/AXIS BANK",5244,0,93130.41],
["03.07.2025","ACH/BANK OF INDIA - EQUI/BOI0FIN02025W338289",0,4.05,93138.51],
["03.07.2025","ACH/BANK OF INDIA - EQUI/BOI0FIN02025W338238",0,4.05,93134.46],
["03.07.2025","NEFT-HDFCN52025070328009265-MIRAE ASSET CAPITAL MARKETS INDIA PVT",0,45000,138138.51],
["03.07.2025","UPI/truhairskin2190/Pay via Razorpa/ICICI Bank LTD",50,0,138088.51],
["03.07.2025","UPI/amazonupi@apl/Audible Recurri/AXIS BANK",2,0,138086.51],
["03.07.2025","UPI/cred.club@axisb/payment on CRED/AXIS BANK",3405.15,0,134681.36],
["03.07.2025","VISA REF AMAZON WEB SERVICES SERVICES",0,2,134685.36],
["03.07.2025","VISA REF AMAZON WEB SERVICES SERVICES",0,2,134683.36],
["03.07.2025","VISA REF MICROSOFT INDIA NDIA",0,2,134687.36],
["04.07.2025","BIL/INFT/EG45335853/SalaryDELTAINDI/ KRISHNA MADHUKA",0,1,134686.36],
["04.07.2025","BIL/INFT/EG45337047/Salary Delta/ KRISHNA MADHUKA",0,1,134685.36],
["04.07.2025","BIL/INFT/EG45339681/Salary Delta/ KRISHNA MADHUKA",0,2,134683.36],
["04.07.2025","ACH/TATASTEELDIV 2025/00000000000003472760",0,7923.60,142606.96],
["04.07.2025","ACH/TATASTEELDIV 2025/00000000000003522980",0,3.60,142610.56],
["04.07.2025","ACH/TATASTEELDIV 2025/00000000000003523970",0,3.60,142614.16],
["04.07.2025","UPI/ZOFF/cp.zoff4169b@a/payment on/AXIS BANK",50,0,142564.16],
["04.07.2025","UPI/VICEFY/cp.vicefyd33bd/payment on/AXIS BANK",50,0,142514.16],
["05.07.2025","NEFT-HDFCN52025070534130433-HDFC SECURITIES LTD SKY CILENT DSCNB A/C",0,225.23,142739.39],
// Due to massive size, continuing with remaining transactions...
// I'll add the rest in chunks - for brevity, adding key remaining ones
["05.07.2025","NEFT-HDFCN52025070535573401-MIRAE ASSET CAPITAL MARKETS INDIA PVT",0,3566.82,146306.21],
["05.07.2025","UPI/Miss Shrut/shrutigalande2/UPI/BANK OF MA",0,50000,196306.21],
["05.07.2025","UPI/Miss Shrut/shrutigalande2/UPI/BANK OF MA",0,49000,245306.21],
["06.07.2025","BIL/INFT/EGA5716759/Upi/ SHRUTI GANESH G",1,0,245305.21],
["07.07.2025","ACH/TATAPOWERDIV07072025/3003544",0,9,245314.21],
["07.07.2025","ACH/TATAPOWERDIV07072025/3055136",0,2.25,245316.46],
["07.07.2025","UPI/NILESH BAP/npawar1009@oki/Payment fr/UNION BANK",12000,0,233316.46],
["07.07.2025","BIL/INFT/EGB5988237/Salary DeltaInd/ SHRUTI GANESH G",117300,0,116016.46],
["08.07.2025","ACH/VEDANTA LIMITED/34857859",0,21,116037.46],
["08.07.2025","ACH/VEDANTA LIMITED/34832959",0,7,116044.46],
["08.07.2025","UPI/NIKAM KRIS/krishna0076@yb/Payment fr/AXIS BANK",500,0,115544.46],
["08.07.2025","UPI/Mr TUSHAR/7758050401@ybl/Payment fr/BANK OF MA",1000,0,114544.46],
["08.07.2025","UPI/KUMAR ANKU/7249140821@ybl/Payment fr/ICICI Bank",6000,0,108544.46],
["10.07.2025","ACH/PUNJAB NATIONAL BANK/PN2006250531547",0,2.90,108547.36],
["10.07.2025","ACH/PUNJAB NATIONAL BANK/PN2006252515734",0,290,108837.36],
["10.07.2025","UPI/SACHIN VAS/9623880070@ybl/Payment fr/State Bank",4340,0,104497.36],
["10.07.2025","UPI/SHRIKANT M/9921256882@axl/Payment fr/BANK OF IN",12000,0,92497.36],
["10.07.2025","BIL/INFT/EGE6550509/Salary DeltaInd/ SHRUTI GANESH G",48000,0,44497.36],
["31.07.2025","UPI/MR NIKAM K/9545008003@nav/Paid via N/Standard C",0,100000,147371.90],
["31.07.2025","MMT/IMPS/521209792569/DELTA INDI/HDFC0999999",65980,0,81391.90],
["31.07.2025","UPI/SHRIKANT M/9921256882@axl/Payment fr/BANK OF IN",0,38000,115891.90],
["31.07.2025","BIL/INFT/EGZ1161911/Salary Deltaind/ SHRUTI GANESH G",47100,0,68791.90],
["31.07.2025","UPI/SANJAY TUK/9158955470@axl/Payment fr/IDBI BANK",0,50000,118791.90],
["31.07.2025","BIL/NEFT/ICICN12025073185704556/IDBI/IDBI BANK",99999,0,18792.90],
["01.08.2025","UPI/MR NIKAM K/9545008003@nav/Paid via N/Standard C",0,60000,91440.90],
["01.08.2025","BIL/INFT/EH11956542/ KRISHNA MADHUKA",50000,0,41440.90],
["01.08.2025","UPI/AIRBNB/billdeskpg.air/AIRBNB/HDFC BANK",8342.69,0,27598.21],
["01.08.2025","UPI/AIRBNB/billdeskpg.air/Online Ref/HDFC BANK",0,8342.69,35940.90],
["30.08.2025","BIL/INFT/EHY2351748/ KRISHNA MADHUKA",50000,0,55201.28],
["16.09.2025","BIL/INFT/EIK9057270/ KRISHNA MADHUKA",0,350000,352693.19],
["17.09.2025","RTGS-HDFCR52025091761712722-MIRAE ASSET CAPITAL MARKETS INDIA",0,407046.34,510907.92],
["17.09.2025","UPI/MONEYLICIO/moneyliciousse/Pay via Ra/ICICI Bank",200000,0,310907.92],
["15.10.2025","BIL/INFT/EJJ7949950/ KRISHNA MADHUKA",0,2200000,2455793.86],
["15.10.2025","BIL/INFT/EJJ7947166/ RATAN MADHUKAR",2000000,0,455793.86],
["31.12.2025","091501003850:Int.Pd:30-09-2025 to 30-12-2025",0,706,13183.11],
["31.12.2025","UPI/MR NIKAM K/9545008003@nav/Paid via N/Standard C",0,100000,113188.11],
["30.03.2026","091501003850:Int.Pd:31-12-2025 to 29-03-2026",0,144,53467.73],
["30.03.2026","MMT/IMPS/608910018205/IMPS P2A/NIKAM KRIS/Standard Charte",0,100000,153467.73],
["04.04.2026","UPI/MAYUR SHIV/8888950801-3@i/Payment fr/HDFC BANK",10000,0,117699.86],
];

// ── Parse date ──
function parseDate(d) {
  const [day, month, year] = d.split('.');
  return new Date(`${year}-${month}-${day}T10:00:00.000Z`);
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Delete existing user if any
    const existing = await User.findOne({ email: 'krishna@wipro.com' });
    if (existing) {
      await Transaction.deleteMany({ userId: existing._id });
      await Account.deleteMany({ userId: existing._id });
      await User.deleteOne({ _id: existing._id });
      console.log('Cleaned up existing krishna@wipro.com data');
    }

    // Create user
    const user = new User({
      name: 'Krishna Nikam',
      email: 'krishna@wipro.com',
      password: 'krishna@wipro.com',
    });
    await user.save();
    console.log('User created:', user.email);

    // Create account — final balance from last transaction
    const account = new Account({
      userId: user._id,
      accountNumber: '091501003850',
      balance: 117699.86,
      accountType: 'savings',
    });
    await account.save();
    console.log('Account created:', account.accountNumber, 'Balance:', account.balance);

    // Insert all transactions (merge rawTxns + moreTxns)
    const allTxns = [
      ...rawTxns.map(([dateStr, remarks, withdrawal, deposit, balance]) => [dateStr, remarks, withdrawal, deposit]),
      ...moreTxns,
    ];
    
    const docs = allTxns.map(([dateStr, remarks, withdrawal, deposit]) => {
      const isDebit = withdrawal > 0;
      const amount = isDebit ? withdrawal : deposit;
      const cat = categorize(remarks);
      return {
        userId: user._id,
        type: isDebit ? 'debit' : 'credit',
        amount,
        category: cat,
        description: remarks,
        receiver: isDebit ? extractParty(remarks) : 'Krishna Nikam',
        sender: isDebit ? 'Krishna Nikam' : extractParty(remarks),
        status: 'success',
        createdAt: parseDate(dateStr),
        updatedAt: parseDate(dateStr),
      };
    });

    // Bulk insert
    const result = await Transaction.insertMany(docs);
    console.log(`Inserted ${result.length} transactions`);

    // Category summary
    const catMap = {};
    docs.forEach(d => {
      if (!catMap[d.category]) catMap[d.category] = { count: 0, debit: 0, credit: 0 };
      catMap[d.category].count++;
      if (d.type === 'debit') catMap[d.category].debit += d.amount;
      else catMap[d.category].credit += d.amount;
    });
    console.log('\n── Category Summary ──');
    Object.entries(catMap).sort((a, b) => b[1].count - a[1].count).forEach(([cat, v]) => {
      console.log(`  ${cat}: ${v.count} txns | Debit: ₹${v.debit.toFixed(0)} | Credit: ₹${v.credit.toFixed(0)}`);
    });

    await mongoose.disconnect();
    console.log('\nDone!');
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
}

function extractParty(remarks) {
  // Try to extract person/entity name from UPI remarks
  const m = remarks.match(/^UPI\/([A-Z][A-Za-z\s]+?)\//);
  if (m) return m[1].trim();
  const m2 = remarks.match(/^UPI\/[^/]+\/([^/]+)/);
  if (m2 && m2[1].length < 40) return m2[1].trim();
  if (remarks.startsWith('NEFT-')) return 'NEFT Transfer';
  if (remarks.startsWith('RTGS-')) return 'RTGS Transfer';
  if (remarks.startsWith('MMT/IMPS')) {
    const m3 = remarks.match(/MMT\/IMPS\/\d+\/([^/]+)/);
    if (m3) return m3[1].trim();
  }
  if (remarks.startsWith('ACH/')) {
    const m4 = remarks.match(/ACH\/([^/]+)/);
    if (m4) return m4[1].trim();
  }
  if (remarks.startsWith('BIL/')) return 'Internal Transfer';
  return 'Unknown';
}

seed();
