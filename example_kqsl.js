let ksql = `
let interval = 1hr;
let stime = datetime('@A_DATE_START');
let etime = datetime('@A_DATE_END');
spicsv
| where plant == '@PLANT' and line in (@LINE) and machineName in (@MACHINE_NAMES) // and IsOK  == '1' 
| where unixtime_milliseconds_todatetime(evt_dt) >= stime and  unixtime_milliseconds_todatetime(evt_dt) < etime
| project  evt_dt_datetime = unixtime_milliseconds_todatetime(evt_dt) , usn,defectCode,evt_dt,IsOK,evt_tp,line,plant,model,location,machineName,evt_ns
| order by evt_dt desc
| limit 1
`;
ksql = ksql.replace(/@A_DATE_START/gi, p_timestampFrom.getFullYear() + '-' + (p_timestampFrom.getMonth() + 1) + '-' + p_timestampFrom.getDate());
ksql = ksql.replace(/@A_DATE_END/gi, p_timestampTo.getFullYear() + '-' + (p_timestampTo.getMonth() + 1) + '-' + p_timestampTo.getDate());
ksql = ksql.replace(/@PLANT/gi, p_plant);




sqlMain = "let mainTable = materialize (smtcycletime2| where stdCycleTime >0 and cycleTimeTransfer <= (stdCycleTime *1.3)" +
        " and plant == '" + plant + "' and line in ('" + lines_array.join("','") + "') and (evt_dt >= " + dts + " and evt_dt < " + dte + "));";
sqlCondition = " let resultTable = materialize(mainTable| where 1 == 1";

    lines_array.forEach(line => {
        console.log(line);
        switch (line) {
            case 'HS2A':
            case 'HS2B':
                sqlCondition += (" and (line == '" + line + "' and machineName has_any('PRINTER','SPI','REFLOW','AOI') and (machineName startswith 'CM' or machineName startswith 'DT' or machineName startswith 'NPM') and (machineName endswith '-1' or machineName endswith '-2' or machineName endswith '-3' or machineName endswith '-4' or machineName endswith '-5' or machineName endswith '-6' or machineName endswith '-7' or machineName endswith '-8'))");
                break;
            case 'HS3A':
            case 'HS3B':
            case 'HS4A':
            case 'HS4B':
            case 'HS5A':
                sqlCondition += (" and (line == '" + line + "' and machineName has_any('PRINTER','SPI','REFLOW','AOI') and (machineName startswith 'CM' or machineName startswith 'DT' or machineName startswith 'NPM') and (machineName endswith '-1' or machineName endswith '-2' or machineName endswith '-3' or machineName endswith '-4' or machineName endswith '-5' or machineName endswith '-6'))");
                break;
            case 'HP2':
            case 'HP3':
                sqlCondition += (" and (line == '" + line + "' and machineName has_any('ATE','AUTO LABELER','FICT','UN-FILL1','UN-FILL2','UNREFLOW','AUTO INSTALLER','INLINE ROUTER','AUTO PACKING'))");
                break;
            case 'HP4':
            case 'HP5':
                sqlCondition += (" and (line == '" + line + "' and machineName has_any('ATE','AUTO LABELER','UN-FILL1','UN-FILL2','UNREFLOW','AUTO INSTALLER','INLINE ROUTER'))");
                break;

            default:
        }
    });
    sqlCondition += (");");
    sqlCondition += ("  resultTable| summarize cycle_time = avg(cycleTimeTransfer) by line, machineName");