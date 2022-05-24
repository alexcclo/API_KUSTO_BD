require('dotenv').config();
const { EventHubProducerClient } = require("@azure/event-hubs");
const express = require('express');
const http = require('request');
const cors = require('cors')
const port = process.env.PORT;
const app = express();
const bodyParser = require('body-parser');
const machineConfig = require('./machine.json');
const HP_MachineName = machineConfig.machineName.HP;
const HS_MachineName = machineConfig.machineName.HS;
const f232_HS_MachineName = machineConfig.f232_machineName.HS;
const f232_HP_MachineName = machineConfig.f232_machineName.HP;
//const _ = require('lodash');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Add headers
app.use(cors());
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    if (process.env.CORS_Environment == 1) {
        //Production
        res.setHeader('Access-Control-Allow-Origin', process.env.CORS_AzureURL);
    } else {
        //Local
        res.setHeader('Access-Control-Allow-Origin', process.env.CORS_LocalURL);
    }
    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET');
    next();
});
app.listen(port, () => console.log(`PCBA OEE API listening on port ${port}!`));
/*
★★★開發注意事項★★★

1.部分function有使用指定時間的方式，在正式機時要移除
    調整的依據請查找一下字眼
        ▲ 標記:正式機
        ▲ 標記:測試機
2.部分function使用模擬es的方式回傳資料，未來可以調整的部分
    調整的依據請查找一下字眼
        ▲ 標記 : 模仿 es 的回傳

★★★必須在正式機上線前要調整的標記★★★
┌──────────────────────────────────────┬──────────────────────────────────┐
│調整的依據請查找一下字眼                │調整的狀態(待處理\完成)             │
├──────────────────────────────────────┼──────────────────────────────────┤
│   標記要調整:時間區段                 │待處理                             │
├──────────────────────────────────────┼──────────────────────────────────┤
│                                      │                                  │
├──────────────────────────────────────┼──────────────────────────────────┤
│                                      │                                  │
└──────────────────────────────────────┴──────────────────────────────────┘
*/
app.get('/', (req, res) => {
    res.send('PCBA OEE');
});
app.post("/dataexplorer/PCBA/query_pcba_reflow_power", async function (req, res) { //by Irving
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        let Site = req.body.Site;
        let Plant = req.body.Plant;
        let Building = req.body.Building;
        let line = req.body.line;
        let Machinename = req.body.Machinename;
        let MachineID = req.body.MachineID;
        let evt_dt = req.body.evt_dt;

        let ksql = "pcba_reflow_power";
        ksql += " | where Site == '" + Site + "'";
        ksql += " and Plant == '" + Plant + "'";
        ksql += " and Building == '" + Building + "'";
        ksql += " and line == '" + line + "'";
        ksql += " and Machinename == '" + Machinename + "'";
        ksql += " and MachineID == '" + MachineID + "'";
        ksql += " and evt_dt >= 0 ";
        ksql += " and evt_dt < " + evt_dt;
        ksql += " | project evt_dt, power";

        //指定data base
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());
                res.send(JSON.parse(results.primaryResults[0]));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.get("/PCBA002/AlertJob/:NowTime", async (req, res) => {
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName;
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        let ksql = "fmsdata| where startdate < " + req.params.NowTime + " and enddate > " + req.params.NowTime + "| limit 200";
        //指定data base
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());
                res.send(JSON.parse(results.primaryResults[0]));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.get("/PCBA/SMTCYCLETIME2/:plant/:line/:dts/:dte", async function (req, res) { //當連線到Root/ 作出回應
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        var ksql = generateKSQL4SMTCT(req.params.plant, req.params.line, req.params.dts, req.params.dte);
        //指定data base:test-db
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());
                res.send(JSON.parse(results.primaryResults[0]));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.get("/PCBA/ACTIVE/:plant/:line/:dts/:dte", async function (req, res) { //當連線到Root/ 作出回應
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);

        var ksql = generateKSQL4PCBAACTIVE(req.params.plant, req.params.line, req.params.dts, req.params.dte);

        //指定data base:test-db
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());
                var response = [];
                var js_tmp_D = {};
                var js_tmp_N = {};
                //D:白班
                var dStartDate;
                //N:夜班
                var nStartDate;

                results.primaryResults[0]._rows.forEach(function (item) {
                    dStartDate = new Date(item[0]);
                    dStartDate.setHours(8);
                    dStartDate.setMinutes(30);

                    nStartDate = new Date(item[0]);
                    nStartDate.setHours(20);
                    nStartDate.setMinutes(30);

                    if (item[1]) {
                        js_tmp_D = {
                            line: item[3],
                            startTime: dStartDate.getTime()
                        };
                        response.push(js_tmp_D);
                    }
                    if (item[2]) {
                        js_tmp_N = {
                            line: item[3],
                            startTime: nStartDate.getTime()
                        };
                        response.push(js_tmp_N);
                    }
                });
                console.log(response);
                res.send(response);
                /*console.log(results.primaryResults[0].toString());
                res.send(JSON.parse(results.primaryResults[0]));*/
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});
app.get("/PCBA/GETLINETIME/:plant/:line/:dts/:dte", async function (req, res) { //當連線到Root/ 作出回應
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);

        var ksql = generateKSQL4PCBAGETLINETIME(req.params.plant, req.params.line, req.params.dts, req.params.dte);

        //指定data base:test-db
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                let response = [];
                let js_tmp = {};
                results.primaryResults[0]._rows.forEach(item => {
                    js_tmp = {
                        line: item[0],
                        startTime: item[1],
                        endTime: item[2]
                    };
                    response.push(js_tmp);
                });
                console.log(response);
                res.send(response);

                /*console.log(results.primaryResults[0].toString());
                res.send(JSON.parse(results.primaryResults[0]));*/
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});
app.get("/PCBA/GETPRESENTLINESNODATETIME/:plant/:lines", async function (req, res) { //當連線到Root/ 作出回應
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        // 取得正在維護的設備
        var ksql = generateKSQL4PCBAGETPRESENTLINESNODATETIME(req.params.plant, req.params.lines);

        //指定data base:test-db
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());
                res.send(JSON.parse(results.primaryResults[0]));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.get("/PCBA/GETPRESENTLINES/:plant/:lines/:presentTime", async function (req, res) { //當連線到Root/ 作出回應
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);

        var ksql = generateKSQL4PCBAGETPRESENTLINES(req.params.plant, req.params.lines, req.params.presentTime);

        //指定data base:test-db
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());
                res.send(JSON.parse(results.primaryResults[0]));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.post("/PCBA/OEE/DurationByLine", async (req, res) => { //(4/8 OK)
    try {
        //let allLines=_.cloneDeep(machineConfig.lines);
        let lines = req.body.line;
        let plant = req.body.plant;
        let must_not = [];
        const timeFrom = req.body.evt_dt_from;
        const timeTo = req.body.evt_dt_to;
        const clusterName = process.env.AzureDataExploere_ClusterName;
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);

        //if  have MUST NOT??
        if (req.body.must_not) {
            must_not = req.body.must_not;
        }
        let firstTable = "let table1 = materialize (pcba3color_duration| where plant == '" + plant + "' ";
        firstTable += "and evt_dt between(" + timeFrom + " .. " + timeTo + "));";

        let ksql = firstTable + f232CommonQuery(lineArrayProcessor(lines, must_not)) + "); table2| summarize duration_sum = sum(Duration), doc_count= count() by line, color";

        //指定data base
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());

                res.send(JSON.parse(results.primaryResults[0]));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.post("/PCBA/OEE/DurationByDay", async (req, res) => { //OEE 內頁 MTD (4/8 OK)
    try {
        let lines = req.body.line;
        let must_not = [];
        let plant = req.body.plant;
        let evt_dt_from = req.body.evt_dt_from;
        let evt_dt_to = req.body.evt_dt_to;
        const clusterName = process.env.AzureDataExploere_ClusterName;
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        if (req.body.must_not) {
            must_not = req.body.must_not;
        }
        let byDayQuery = " table2|make-series duration_sum=sum(Duration) default=0";
        byDayQuery += " on evt_dt from " + evt_dt_from + " to " + evt_dt_to + " step 86400000";//1d = 86400 sec = 86400000 millsec
        byDayQuery += " by line, color";
        let firstTable = "let table1 = materialize (pcba3color_duration| where plant == '" + plant + "' ";
        firstTable += "and evt_dt between(" + evt_dt_from + " .. " + evt_dt_to + "));";
        let ksql = firstTable + f232CommonQuery(lineArrayProcessor(lines, must_not)) + ");" + byDayQuery;
        console.log(ksql);
        //指定data base
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());

                res.send(JSON.parse(results.primaryResults[0]));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.post("/PCBA/OEE/DurationByHour", async (req, res) => { //OEE 內頁 today (4/8 OK)
    try {
        let evt_dt_from = req.body.evt_dt_from;//time
        let evt_dt_to = req.body.evt_dt_to;
        let plant = req.body.plant;
        let lines = req.body.line;
        let must_not = [];
        if (req.body.must_not) {
            must_not = req.body.must_not;
        }
        const clusterName = process.env.AzureDataExploere_ClusterName;
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        let byHourQuery = " table2|make-series duration_sum=sum(Duration) default=0";
        byHourQuery += " on evt_dt from " + evt_dt_from + " to " + evt_dt_to + " step 3600000";//1hr = 3600sec= 3600000millsec
        byHourQuery += " by line, color";
        let firstTable = "let table1 = materialize (pcba3color_duration| where plant == '" + plant + "'";
        firstTable += " and evt_dt between(" + evt_dt_from + " .. " + evt_dt_to + "));";
        let ksql = firstTable + f232CommonQuery(lineArrayProcessor(lines, must_not)) + ");" + byHourQuery;
        console.log(ksql);
        //指定data base
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());

                res.send(JSON.parse(results.primaryResults[0]));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.post("/PCBA/OEE/pilotrunService/getDurationByPeriods", async (req, res) => { //pcba_pilotrun_delta
    try {
        const table = "pcba_pilotrun_delta";
        const data = req.body;
        let plant = req.body.plant;
        let lines = req.body.lines;
        let startTime = req.body.startTime;
        let endTime = req.body.endTime;
        const clusterName = process.env.AzureDataExploere_ClusterName;
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        let result = getPeriodList(data.startTime, data.endTime, data.periodType);
        let ksql = getQueryByLines(table, lines, plant, startTime, endTime);

        let testkql
        //指定data base
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());

                results.forEach(records => {
                    let startTime = records.key;
                    let endTime = records.maxEnddate;

                    result.forEach(element => {
                        if (element.duration == null) element.duration = 0;
                        if (startTime >= element.from && endTime <= element.to) {
                            element.duration += endTime - startTime;
                        }
                        if (startTime <= element.from && endTime >= element.to) {
                            element.duration += element.to - element.from + 1;
                        }
                        else if (startTime >= element.from && startTime <= element.to && endTime > element.to) {
                            element.duration += element.to - startTime + 1;
                        }
                        else if (startTime < element.from && endTime >= element.from && endTime <= element.to) {
                            element.duration += endTime - element.from;
                        }
                    });
                });

                res.send(JSON.parse(result));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.post("/PCBA/OEE/noscheduleManager/getLinesTime", async (req, res) => { //pcba_noschedule_delta
    try {
        const table = "pcba_noschedule_delta";
        let plant = req.body.plant;
        let lines = req.body.line;
        let startTime = req.body.startTime;
        let endTime = req.body.endTime;
        const clusterName = process.env.AzureDataExploere_ClusterName;
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        let ksql = getQueryByLines(table, lines, plant, startTime, endTime);//query statement same as pilotrunService
        let response = [];
        //指定data base
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());
                results.primaryResults[0].forEach(element => {
                    response.push({
                        line: element.key,
                        startTime: element.key,
                        endTime: element.maxEnddate
                    });
                });
                res.send(JSON.parse(response));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.post("/PCBA/OEE/noscheduleManager/getDurationByPeriods", async (req, res) => { //pcba_noschedule_delta
    try {
        const table = "pcba_noschedule_delta";
        let plant = req.body.plant;
        let lines = req.body.line;
        let startTime = req.body.startTime;
        let endTime = req.body.endTime;
        const clusterName = process.env.AzureDataExploere_ClusterName;
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        let result = getPeriodList(startTime, endTime, req.body.periodType);
        let ksql = getQueryByLines(table, lines, plant, startTime, endTime);//query statement same as pilotrunService

        //指定data base
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());

                results.forEach(records => {
                    let startTime = records.key;
                    let endTime = records.maxEnddate;

                    result.forEach(element => {
                        if (element.duration == null) element.duration = 0;
                        if (startTime >= element.from && endTime <= element.to) {
                            element.duration += endTime - startTime;
                        }
                        if (startTime <= element.from && endTime >= element.to) {
                            element.duration += element.to - element.from + 1;
                        }
                        else if (startTime >= element.from && startTime <= element.to && endTime > element.to) {
                            element.duration += element.to - startTime + 1;
                        }
                        else if (startTime < element.from && endTime >= element.from && endTime <= element.to) {
                            element.duration += endTime - element.from;
                        }
                    });
                });
                res.send(JSON.parse(result));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.post("/PCBA/OEE/changeLine/getDurationByPeriods", async (req, res) => { //pcba_changeline 5/8 OK
    try {
        let plant = req.body.plant;
        let lines = req.body.lines;
        let startTime = req.body.startTime;
        let endTime = req.body.endTime;
        const clusterName = process.env.AzureDataExploere_ClusterName;
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        let result = getPeriodList(startTime, endTime, req.body.periodType);
        let ksql = getQueryByLines_changeLine(lines, plant, startTime, endTime, req.body.unActiveLinesTime, req.body.fmsLinesTime);

        //指定data base
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());

                results.forEach(records => {
                    let startTime = records.key;
                    let endTime = records.maxEnddate;

                    result.forEach(element => {
                        if (element.duration == null) element.duration = 0;
                        if (startTime >= element.from && endTime <= element.to) {
                            element.duration += endTime - startTime;
                        }
                        if (startTime <= element.from && endTime >= element.to) {
                            element.duration += element.to - element.from + 1;
                        }
                        else if (startTime >= element.from && startTime <= element.to && endTime > element.to) {
                            element.duration += element.to - startTime + 1;
                        }
                        else if (startTime < element.from && endTime >= element.from && endTime <= element.to) {
                            element.duration += endTime - element.from;
                        }
                    });
                });
                res.send(JSON.parse(result));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.post("/PCBA/OEE/fmsService/getDurationByPeriods", async (req, res) => { //fmsdata (4/17 OK)(startdata enddate no data )
    try {
        const table = "fmsdata";
        let plant = req.body.plant;
        let lines = req.body.line;
        let startTime = req.body.startTime;
        let endTime = req.body.endTime;
        const clusterName = process.env.AzureDataExploere_ClusterName;
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        let result = getPeriodList(startTime, endTime, req.body.periodType);
        let ksql = table + "| where plant == '" + plant + "' and line has_any('" + lines.join("','") + "') and startdate > " + startTime + " and enddate < " + endTime;
        ksql += " |summarize maxEnddate=max(enddate), doc_count=count() by line, startdate |limit 10000";
        //指定data base
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());

                results.primaryResults[0].data.forEach(records => {
                    let startTime = records.key;
                    let endTime = records.maxEnddate;

                    result.forEach(element => {
                        if (element.duration == null) element.duration = 0;
                        if (startTime >= element.from && endTime <= element.to) {
                            element.duration += endTime - startTime;
                        }
                        if (startTime <= element.from && endTime >= element.to) {
                            element.duration += element.to - element.from + 1;
                        }
                        else if (startTime >= element.from && startTime <= element.to && endTime > element.to) {
                            element.duration += element.to - startTime + 1;
                        }
                        else if (startTime < element.from && endTime >= element.from && endTime <= element.to) {
                            element.duration += endTime - element.from;
                        }
                    });
                });
                res.send(JSON.parse(result));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.post("/PCBA/3COLORDURATION", async (req, res) => { //當連線到Root/ 作出回應
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        // res.send(req.params.name)

        var ksql = generateKSQL4PCBA3COLORDURATION(req.body.plant, req.body.line, req.body.evt_dt_from, req.body.evt_dt_to);
        //指定data base:test-db
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());
                res.send(JSON.parse(results.primaryResults[0]));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.post("/PCBA/GETPOSTAOI", async (req, res) => { //當連線到Root/ 作出回應
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);

        var ksql = generateKSQL4PCBAGETPOSTAOI(req.params.plant, req.params.line, req.params.stage, req.params.startTime, req.params.endTime);

        //指定data base:test-db
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                let response = [];
                let js_tmp = { "pass": 0, "NG": 0 };

                results.primaryResults[0]._rows.forEach(item => {
                    if (item[0] == 0) {
                        js_tmp = {
                            NG: item[1],
                            pass: 0
                        };
                    } else if (item[0] == 1) {
                        js_tmp = {
                            NG: 0,
                            pass: item[1]
                        };
                    }
                    response.push(js_tmp);
                });
                console.log(response);
                res.send(response);
            }
        });
    }
    catch (e) {
        console.log(e);
        res.send(e);
    }
});
app.post("/PCBA/OEE/fmsService/getLinesTime", async (req, res) => { //
    try {
        const table = "fmsdata";
        let plant = req.body.plant;
        let lines = req.body.line;
        let startTime = req.body.startTime;
        let endTime = req.body.endTime;
        const clusterName = process.env.AzureDataExploere_ClusterName;
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        let ksql = table + "| where plant == '" + plant + "' and line has_any('" + lines.join("','") + "') and startdate > " + startTime + " and enddate < " + endTime;
        ksql += " |summarize maxEnddate=max(enddate), doc_count=count() by line, startdate |limit 10000";
        //指定data base
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());
                let result = [];
                results.primaryResults[0].data.forEach(item => {
                    result.push({
                        line: line,
                        startTime: item.key,
                        endTime: item.maxEnddate.value
                    });
                });
                res.send(JSON.parse(result));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.post("/PCBA/OEE1/shift", async (req, res) => { //設備時間稼動率(當班)圓餅圖1~3層ES query (4/16 Test OK)
    try {
        let customLines = req.body.line;
        let colorQuery = "";
        const plant = req.body.plant;
        const timeFrom = req.body.evt_dt_from;
        const timeTo = req.body.evt_dt_to;
        const colors = req.body.color;
        const clusterName = process.env.AzureDataExploere_ClusterName;
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        if (colors.length != 0) {
            colorQuery = "and color in('" + colors.join("','") + "'));";
        } else {
            colorQuery = "and color !in('Green','Yellow','YG','Red');";
        }
        let ksql = "let table1 = materialize (pcba3color_duration| where plant == '" + plant + "' and machineName has_any('" + HS_MachineName.join("','") + "')";
        ksql += "and evt_dt between(" + timeFrom + " .. " + timeTo + ") and Duration >= 0 " + colorQuery;
        ksql += f232CommonQuery(lineArrayProcessor(customLines, [])) + ");";
        ksql += "table2| summarize duration_sum = sum(Duration), doc_count=count() by line, machineName;";

        //指定data base
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());

                res.send(JSON.parse(results.primaryResults[0]));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.post("/PCBA/OEE1/shift/report", async (req, res) => { //設備時間稼動率(當班)圓餅圖第四層報表(4/16 test OK)
    try {
        let colorQuery = "";
        const line = req.body.line;//array
        const machineName = req.body.machineName;
        const plant = req.body.plant;
        const timeFrom = req.body.evt_dt_from;
        const timeTo = req.body.evt_dt_to;
        const colors = req.body.color;//array
        const clusterName = process.env.AzureDataExploere_ClusterName;
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        if (colors.length != 0) {
            colorQuery = "and color in('" + colors.join("','") + "')";
        } else {
            colorQuery = "and color !in('Green','Yellow','YG','Red')";
        }
        let ksql = "pcba3color_duration| where plant == '" + plant + "' and line has_any('" + line.join("','") + "')";
        ksql += " and machineName =='" + machineName + "' and evt_dt between(" + timeFrom + " .. " + timeTo + ") and Duration >= 3000 ";
        ksql += colorQuery + " | sort by line asc, machineName asc, evt_dt asc |limit 10000";



        //指定data base
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());

                res.send(JSON.parse(results.primaryResults[0]));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.post("/PCBA/getMachineNameDurationByShiftHour", async (req, res) => { //overview printer 
    try {
        const plant = req.body.plant;
        const line = req.body.line;
        const timeFrom = req.body.evt_dt_from;
        const timeTo = req.body.evt_dt_to;
        const machineName = req.body.machineName; //array
        const clusterName = process.env.AzureDataExploere_ClusterName;
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        let ksql = "pcba3color_duration| where plant == '" + plant + "' and line == '" + line + "' and machineName in ('" + machineName.join("','") + "')"
        ksql += " |make-series duration_sum = sum(Duration) default=0 on evt_dt from " + timeFrom + " to " + timeTo + " step 3600000 by color";
        //指定data base
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());

                res.send(JSON.parse(results.primaryResults[0]));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.post("/PCBA/OEE15/getLossByShiftHours", async (req, res) => { //
    try {
        let evt_dt_from = req.body.evt_dt_from;//time
        let evt_dt_to = req.body.evt_dt_to;
        let plant = req.body.plant;
        let lines = req.body.line;
        let must_not = [];
        if (req.body.must_not) {
            must_not = req.body.must_not;
        }
        const clusterName = process.env.AzureDataExploere_ClusterName;
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        let subQuery = `let table3 = materialize (table2| where Duration <60000 | make-series duration_sum_sub=sum(Duration) default=0, minior_stop = count() default =0 on evt_dt from ${evt_dt_from} to ${evt_dt_to} step 3600000  by color);`;
        subQuery += `let table4 = materialize (table2| where Duration >60000 | make-series duration_sum_sub=sum(Duration) default=0, break_down = count() default =0 on evt_dt from ${evt_dt_from} to ${evt_dt_to} step 3600000  by color);`;
        let finalQuery = `let table5 = materialize (table2| make-series duration_sum = sum(Duration) default=0 on evt_dt from ${evt_dt_from} to ${evt_dt_to} step 3600000  by color); table5; table3|union table4;`;
        let firstTable = "let table1 = materialize (pcba3color_duration| where plant == '" + plant + "'";
        firstTable += " and evt_dt between(" + evt_dt_from + " .. " + evt_dt_to + ") and color != 'Green');";
        let ksql = firstTable + f232CommonQuery(lineArrayProcessor(lines, must_not)) + ");" + subQuery + finalQuery;
        console.log(ksql);
        //指定data base
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                let result = [];
                results.primaryResults.forEach(table => {//2 table
                    result.push(JSON.parse(table));
                    console.log(JSON.parse(table));
                })
                res.send(result);
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.post("/sendEventHub", async (req, res) => {
    try {
        const connectionString = process.env.SendEventHubConnection;
        const eventHubName = req.body.topic;
        const data = req.body;
        const producer = new EventHubProducerClient(connectionString, eventHubName);
        const batch = await producer.createBatch();
        batch.tryAdd({ body: data });
        await producer.sendBatch(batch);
        // Close the producer client.
        await producer.close();
        res.send("events have been sent to the topic: " + eventHubName);
    } catch (e) {
        console.log(e);
        res.send(e);
    }


});

app.post("/TeamsNotify", async (req, res) => {
    http({
        method: 'POST',
        uri: process.env.TeamsLogicAppAPi,
        json: req.body
    }, (error, response) => {
        if (error) {
            res.send(response.body.statusCode);
        } else {
            res.send(response.body);
        }
    });
});

function getPeriodList(startTime, endTime, periodType) {
    let list = [];
    let dateCursor = new Date(startTime);
    const PeriodType = {
        hour: 'hour',
        day: 'day',
        week: 'week',
        month: 'month'
    };
    while (dateCursor.getTime() < endTime) {
        let timestampFrom = dateCursor.getTime();

        switch (periodType) {
            case PeriodType.hour:
                dateCursor.setHours(dateCursor.getHours() + 1);
                break;
            case PeriodType.day:
                dateCursor.setDate(dateCursor.getDate() + 1);
                break;
            case PeriodType.week:
                dateCursor.setDate(dateCursor.getDate() + 7);
                break;
            case PeriodType.month:
                dateCursor.setMonth(dateCursor.getMonth() + 1);
                break;
        }

        list.push({
            from: timestampFrom,
            to: dateCursor.getTime() - 1
        });
    }

    return list;
}
function lineArrayProcessor(lines, notLineArray) {
    let newLinesArray = [];
    let _notLineArray = [];//just take notLineArray's line
    if (notLineArray.length != 0 || notLineArray != undefined) {
        for (let i in notLineArray) {
            if (!_notLineArray.includes(notLineArray[i].line)) {
                _notLineArray.push(notLineArray[i].line);
            }
        }
        notLineArray.forEach(element => {
            newLinesArray.push([element.line, 1, element.evt_dt_from, element.evt_dt_to]);
        });
        if (lines.length >= _notLineArray.length) {//push line which not in must_not(notLineArray)
            let mustArray = lines.filter(e => {
                return _notLineArray.indexOf(e) === -1
            });
            mustArray.forEach(element => {
                newLinesArray.push([element, 0]);
            });
        }
    } else {// no must not 
        lines.forEach(element => {
            newLinesArray.push([element, 0]);
        });

    }
    return newLinesArray;
}
function commonQuery(lines) {
    lines.sort();
    console.table(lines)
    let commonQuery = "";
    let HpQuery = "let table2 = materialize(table1| where";
    let HsQuery = "";

    lines.forEach((line, index) => {
        switch (line[0]) {
            case 'HS3A':
            case 'HS3B':
                if (index == lines.length - 1 && line[1] != 1) {//last and not in must_not,no need 'or'
                    HsQuery += " line == '" + line[0] + "' and machineName has_any('" + HS_MachineName.join("','") + "') or";
                    HsQuery += " line == '" + line[0] + "' and (machineName startswith 'CM' or machineName startswith 'DT' or machineName startswith 'NPM' and"
                    HsQuery += " machineName endswith '-1'or machineName endswith '-2'or machineName endswith '-3'or machineName endswith '-4'or machineName endswith '-5'or machineName endswith '-6')"

                } else if (index == lines.length - 1 && line[1] == 1) {//last and in must_not,no need 'or'and add !between
                    HsQuery += " line == '" + line[0] + "' and machineName has_any('" + HS_MachineName.join("','") + "') or";
                    HsQuery += " line == '" + line[0] + "' and (machineName startswith 'CM' or machineName startswith 'DT' or machineName startswith 'NPM' and"
                    HsQuery += " machineName endswith '-1'or machineName endswith '-2'or machineName endswith '-3'or machineName endswith '-4'or machineName endswith '-5'or machineName endswith '-6')"
                    HsQuery += " and evt_dt !between(" + line[2] + " .. " + line[3] + ")"
                } else {
                    if (line[1] != 1) {//not last and not mustnot
                        HsQuery += " line == '" + line[0] + "' and machineName has_any('" + HS_MachineName.join("','") + "') or";
                        HsQuery += " line == '" + line[0] + "' and machineName startswith 'CM' or machineName startswith 'DT' or machineName startswith 'NPM' and"
                        HsQuery += " (machineName endswith '-1'or machineName endswith '-2'or machineName endswith '-3'or machineName endswith '-4'or machineName endswith '-5'or machineName endswith '-6') or"
                    }
                    if (line[1] == 1) {//not last and in mustnot
                        HsQuery += " line == '" + line[0] + "' and machineName has_any('" + HS_MachineName.join("','") + "') or";
                        HsQuery += " line == '" + line[0] + "' and machineName startswith 'CM' or machineName startswith 'DT' or machineName startswith 'NPM' and"
                        HsQuery += " (machineName endswith '-1'or machineName endswith '-2'or machineName endswith '-3'or machineName endswith '-4'or machineName endswith '-5'or machineName endswith '-6')"
                        HsQuery += " and evt_dt !between(" + line[2] + " .. " + line[3] + ") or"
                    }
                }
                break;
            case 'HS2A':
            case 'HS2B':
            case 'HS4A':
            case 'HS4B':
            case 'HS5A':
                if (index == lines.length - 1 && line[1] != 1) {//last and not in must_not,no need 'or'
                    HsQuery += " line == '" + line[0] + "' and machineName has_any('" + HS_MachineName.join("','") + "') or";
                    HsQuery += " line == '" + line[0] + "' and (machineName startswith 'CM' or machineName startswith 'DT' or machineName startswith 'NPM' and"
                    HsQuery += " machineName endswith '-1'or machineName endswith '-2'or machineName endswith '-3'or machineName endswith '-4'or machineName endswith '-5'or machineName endswith '-6'or machineName endswith '-7'or machineName endswith '-8')"

                } else if (index == lines.length - 1 && line[1] == 1) {//last and in must_not,no need 'or'and add !between
                    HsQuery += " line == '" + line[0] + "' and machineName has_any('" + HS_MachineName.join("','") + "') or";
                    HsQuery += " line == '" + line[0] + "' and (machineName startswith 'CM' or machineName startswith 'DT' or machineName startswith 'NPM' and"
                    HsQuery += " machineName endswith '-1'or machineName endswith '-2'or machineName endswith '-3'or machineName endswith '-4'or machineName endswith '-5'or machineName endswith '-6'or machineName endswith '-7'or machineName endswith '-8')"
                    HsQuery += " and evt_dt !between(" + line[2] + " .. " + line[3] + ")"
                } else {
                    if (line[1] != 1) {//not last and not mustnot
                        HsQuery += " line == '" + line[0] + "' and machineName has_any('" + HS_MachineName.join("','") + "') or";
                        HsQuery += " line == '" + line[0] + "' and (machineName startswith 'CM' or machineName startswith 'DT' or machineName startswith 'NPM' and"
                        HsQuery += " machineName endswith '-1'or machineName endswith '-2'or machineName endswith '-3'or machineName endswith '-4'or machineName endswith '-5'or machineName endswith '-6'or machineName endswith '-7'or machineName endswith '-8') or"
                    }
                    if (line[1] == 1) {//not last and in mustnot
                        HsQuery += " line == '" + line[0] + "' and machineName has_any('" + HS_MachineName.join("','") + "') or";
                        HsQuery += " line == '" + line[0] + "' and (machineName startswith 'CM' or machineName startswith 'DT' or machineName startswith 'NPM' and"
                        HsQuery += " machineName endswith '-1'or machineName endswith '-2'or machineName endswith '-3'or machineName endswith '-4'or machineName endswith '-5'or machineName endswith '-6'or machineName endswith '-7'or machineName endswith '-8')"
                        HsQuery += " and evt_dt !between(" + line[2] + " .. " + line[3] + ") or"
                    }
                }
                break;
            case 'HP2':
            case 'HP3':
            case 'HP4':
            case 'HP5':
                //if (lines[lines.length - 1][0] == line[0]) {//last,no need 'or'
                if (index == lines.length - 1) {
                    HpQuery += " line == '" + line[0] + "' and machineName has_any('" + HP_MachineName.join("','") + "')"
                }
                else {
                    HpQuery += " line == '" + line[0] + "' and machineName has_any('" + HP_MachineName.join("','") + "') or"
                }
                break;
        }
    });
    commonQuery = HpQuery + HsQuery;
    return commonQuery;
}
function getQueryByLines(table, lines, plant, startTime, endTime) {
    let kql = table + "| where plant == '" + plant + "' and line has_any('" + lines.join("','") + "') and start_dt > " + startTime + " and end_dt <" + endTime;
    kql += "|summarize maxEnddate=max(end_dt), doc_count=count() by line, start_dt ";
    return kql;
}
function getQueryByLines_changeLine(lines, plant, startTime, endTime, unActiveLinesTime, fmsLinesTime) {
    let firstTable = "let table1 = materialize (pcba_changeline| where plant == '" + plant + "' and line has_any('" + lines.join("','") + "')";
    firstTable += "and startChangeLineDate <" + endTime + " and " + startTime + " < startChangeLineDate + (changeTime*60*1000)); ";
    let notQuery_ = 'let table2 = materialize (table1';// if return
    let notQuery = "let table2 = materialize (table1|where"; //if not return
    let count = 0;
    if (unActiveLinesTime.length > 0) {
        unActiveLinesTime.forEach((lineTime, index) => {
            let line = lineTime.line;
            if (!lines.find(line => line == lineTime.line)) {//must_not lines not in must line
                return;
            }

            else {
                count += 1;
                if (index == unActiveLinesTime.length - 1) {//the last no need or
                    notQuery += " line == '" + line + "' and evt_dt !between(" + lineTime.startTime + " .. " + lineTime.endTime + ")";
                }
                else {
                    notQuery += " line == '" + line + "' and evt_dt !between(" + lineTime.startTime + " .. " + lineTime.endTime + ") or";
                }
            }
        });
    }
    if (fmsLinesTime.length > 0) {
        fmsLinesTime.forEach(lineTime => {
            if (!lines.find(line => line == lineTime.line)) return;
            else {
                if (lines.indexOf(line) == lines.length - 1) {//the last no need or
                    notQuery += " and line == " + line + " and evt_dt !between(" + lineTime.startTime + " .. " + lineTime.endTime + ")";
                }
                else {
                    notQuery += " and line == " + line + " and evt_dt !between(" + lineTime.startTime + " .. " + lineTime.endTime + ") or";
                }
            }
        });
    }
    let kql;
    if (count == 0) {
        kql = firstTable + notQuery_ + "|summarize maxChangeTime=max(changeTime), doc_count=count() by line, startChangeLineDate | limit 10000); table2; ";
    } else {
        kql = firstTable + notQuery + "|summarize maxChangeTime=max(changeTime), doc_count=count() by line, startChangeLineDate | limit 10000); table2; ";
    }

    return kql;
}
function f232CommonQuery(lines) {
    lines.sort();
    console.table(lines)
    let commonQuery = "";
    let HpQuery = "let table2 = materialize(table1| where";
    let HsQuery = "";

    lines.forEach((line, index) => {
        switch (line[0]) {
            case 'HSA':
            case 'HSB':
            case 'HS6':
            case 'HS7':
            case 'HS8':
            case 'HS9':
                if (index == lines.length - 1 && line[1] != 1) {//last and not in must_not,no need 'or'
                    HsQuery += " line == '" + line[0] + "' and machineName has_any('" + f232_HS_MachineName.join("','") + "') or";
                    HsQuery += " line == '" + line[0] + "' and (machineName startswith 'CM' or machineName startswith 'DT' or machineName startswith 'NPM' and"
                    HsQuery += " machineName endswith '-1'or machineName endswith '-2'or machineName endswith '-3'or machineName endswith '-4'or machineName endswith '-5')"

                } else if (index == lines.length - 1 && line[1] == 1) {//last and in must_not,no need 'or'and add !between
                    HsQuery += " line == '" + line[0] + "' and machineName has_any('" + f232_HS_MachineName.join("','") + "') or";
                    HsQuery += " line == '" + line[0] + "' and (machineName startswith 'CM' or machineName startswith 'DT' or machineName startswith 'NPM' and"
                    HsQuery += " machineName endswith '-1'or machineName endswith '-2'or machineName endswith '-3'or machineName endswith '-4'or machineName endswith '-5')"
                    HsQuery += " and evt_dt !between(" + line[2] + " .. " + line[3] + ")"
                } else {
                    if (line[1] != 1) {//not last and not mustnot
                        HsQuery += " line == '" + line[0] + "' and machineName has_any('" + f232_HS_MachineName.join("','") + "') or";
                        HsQuery += " line == '" + line[0] + "' and machineName startswith 'CM' or machineName startswith 'DT' or machineName startswith 'NPM' and"
                        HsQuery += " (machineName endswith '-1'or machineName endswith '-2'or machineName endswith '-3'or machineName endswith '-4'or machineName endswith '-5') or"
                    }
                    if (line[1] == 1) {//not last and in mustnot
                        HsQuery += " line == '" + line[0] + "' and machineName has_any('" + f232_HS_MachineName.join("','") + "') or";
                        HsQuery += " line == '" + line[0] + "' and machineName startswith 'CM' or machineName startswith 'DT' or machineName startswith 'NPM' and"
                        HsQuery += " (machineName endswith '-1'or machineName endswith '-2'or machineName endswith '-3'or machineName endswith '-4'or machineName endswith '-5')"
                        HsQuery += " and evt_dt !between(" + line[2] + " .. " + line[3] + ") or"
                    }
                }
                break;
            case 'HSC':
                if (index == lines.length - 1 && line[1] != 1) {//last and not in must_not,no need 'or'
                    HsQuery += " line == '" + line[0] + "' and machineName has_any('" + f232_HS_MachineName.join("','") + "') or";
                    HsQuery += " line == '" + line[0] + "' and (machineName startswith 'CM' or machineName startswith 'DT' or machineName startswith 'NPM' and"
                    HsQuery += " machineName endswith '-1'or machineName endswith '-2'or machineName endswith '-3'or machineName endswith '-4'or machineName endswith '-5'or machineName endswith '-6'or machineName endswith '-7'or machineName endswith '-8'or machineName endswith '-9'or machineName endswith '-10')"

                } else if (index == lines.length - 1 && line[1] == 1) {//last and in must_not,no need 'or'and add !between
                    HsQuery += " line == '" + line[0] + "' and machineName has_any('" + f232_HS_MachineName.join("','") + "') or";
                    HsQuery += " line == '" + line[0] + "' and (machineName startswith 'CM' or machineName startswith 'DT' or machineName startswith 'NPM' and"
                    HsQuery += " machineName endswith '-1'or machineName endswith '-2'or machineName endswith '-3'or machineName endswith '-4'or machineName endswith '-5'or machineName endswith '-6'or machineName endswith '-7'or machineName endswith '-8'or machineName endswith '-9'or machineName endswith '-10')"
                    HsQuery += " and evt_dt !between(" + line[2] + " .. " + line[3] + ")"
                } else {
                    if (line[1] != 1) {//not last and not mustnot
                        HsQuery += " line == '" + line[0] + "' and machineName has_any('" + f232_HS_MachineName.join("','") + "') or";
                        HsQuery += " line == '" + line[0] + "' and (machineName startswith 'CM' or machineName startswith 'DT' or machineName startswith 'NPM' and"
                        HsQuery += " machineName endswith '-1'or machineName endswith '-2'or machineName endswith '-3'or machineName endswith '-4'or machineName endswith '-5'or machineName endswith '-6'or machineName endswith '-7'or machineName endswith '-8'or machineName endswith '-9'or machineName endswith '-10') or"
                    }
                    if (line[1] == 1) {//not last and in mustnot
                        HsQuery += " line == '" + line[0] + "' and machineName has_any('" + f232_HS_MachineName.join("','") + "') or";
                        HsQuery += " line == '" + line[0] + "' and (machineName startswith 'CM' or machineName startswith 'DT' or machineName startswith 'NPM' and"
                        HsQuery += " machineName endswith '-1'or machineName endswith '-2'or machineName endswith '-3'or machineName endswith '-4'or machineName endswith '-5'or machineName endswith '-6'or machineName endswith '-7'or machineName endswith '-8'or machineName endswith '-9'or machineName endswith '-10')"
                        HsQuery += " and evt_dt !between(" + line[2] + " .. " + line[3] + ") or"
                    }
                }
                break;
        }
    });
    commonQuery = HpQuery + HsQuery;
    return commonQuery;
}
function generateKSQL4PCBAGETPOSTAOI(plant, lines, stage, startTime, endTime) {
    var lines_array = lines.split(",");
    var result = "pcba_active_transaction_all| where PLANT == '" + plant + "' and LINE in ('" + lines_array.join("','") + "') and STAGE =='" + stage + "' and TRNDATE between(" + startTime + " .. " + endTime + ")| summarize count_sum = sum(PASSCOUNT), doc_count = count() by RESULTFLAG;";
    console.log("getPostAOI:" + result);
    return result;
}
//取得現在正在維護的line  by canred
// 使用UI： PCBA 的保養狀態會
function generateKSQL4PCBAGETPRESENTLINESNODATETIME(plant, lines) {
    var lines_array = lines.split(",");
    //var result = "fmsdata| where plant == '" + plant + "' and line in ('" + lines_array.join("','") + "')| summarize by line";
    var result = "fmsdata| where plant == '" + plant + "' and line in ('" + lines_array.join("','") + "')";
    result += ' | where startdate > 0 ';
    result += ' | project   startdate = toint( format_datetime(unixtime_milliseconds_todatetime(startdate),\'yyyyMMdd\') ), ';
    result += '             enddate = toint(format_datetime(unixtime_milliseconds_todatetime(enddate),\'yyyyMMdd\') ),';
    result += '             evt_ns,evt_tp,pubBy,evt_dt,plant,line,plandate,lastdate,lasttype,nextdate ';
    result += ' | where startdate >= toint(format_datetime(now(),\'yyyyMMdd\')) and enddate >= toint(format_datetime(now(),\'yyyyMMdd\')) ';
    result += ' | summarize by line '
    console.log("getPresentLinesNoDateTime:" + result);

    /*
    測試的Ksql

    fmsdata
    | where plant == 'F232'
    | where line in ('HS6','HS6','HS7','HS7','HS8','HS8','HS9','HS9','HSA','HSA','HSB','HSB','HSC','HSC')
    | where startdate > 0
    | project   startdate = toint( format_datetime(unixtime_milliseconds_todatetime(startdate),'yyyyMMdd') ),
                enddate = toint(format_datetime(unixtime_milliseconds_todatetime(enddate),'yyyyMMdd') ),
                evt_ns,evt_tp,pubBy,evt_dt,plant,line,plandate,lastdate,lasttype,nextdate
    | where startdate >= toint(format_datetime(now(),'yyyyMMdd')) and enddate >= toint(format_datetime(now(),'yyyyMMdd'))
    | summarize by line
    */
    return result;
}
function generateKSQL4PCBAGETPRESENTLINES(plant, lines, presentTime) {
    var lines_array = lines.split(",");
    var result = "fmsdata| where plant == '" + plant + "' and line in ('" + lines_array.join("','") + "') and (plandate >= " + presentTime + " and lastdate <= " + presentTime + ")| summarize by line";
    console.log("getPresentLines:" + result);
    return result;
}
function generateKSQL4PCBAGETLINETIME(plant, lines, dts, dte) {
    var lines_array = lines.split(",");
    var result = "fmsdata| where plant == '" + plant + "' and line in ('" + lines_array.join("','") + "') and (plandate > " + dte + " and lastdate <= " + dts + ")| summarize maxEnddate = max(enddate) by line,startdate;";
    console.log("fmsdata:" + result);
    return result;
}
function generateKSQL4PCBAACTIVE(plant, lines, dts, dte) {
    var lines_array = lines.split(",");
    var result = "pcba_active| where plant == '" + plant + "' and line in ('" + lines_array.join("','") + "') and (evt_dt >= " + dts + " and evt_dt < " + dte + ")| summarize doc_count = count() by activedate,D,N,line;";
    console.log("pcba_active:" + result);
    return result;
}
function generateKSQL4PCBA3COLORDURATION(plant, lines, dts, dte) {
    var result = "";
    var sqlMain = "";
    var sqlCondition = "";
    var lines_array = lines;

    sqlMain = "let mainTable = materialize (pcba3color_duration| where plant == '" + plant + "' and line in ('" + lines_array.join("','") + "') and (evt_dt >= " + dts + " and evt_dt < " + dte + "));";

    sqlCondition += " let resultTable = materialize(mainTable| where 1==1";

    lines_array.forEach(line => {
        console.log(line);
        switch (line) {
            case 'HS2A':
            case 'HS2B':
                sqlCondition += " or (line == '" + line + "' and machineName has_any('PRINTER','SPI','REFLOW','AOI') and (machineName startswith 'CM' or machineName startswith 'DT' or machineName startswith 'NPM') and (machineName endswith '-1' or machineName endswith '-2' or machineName endswith '-3' or machineName endswith '-4' or machineName endswith '-5' or machineName endswith '-6' or machineName endswith '-7' or machineName endswith '-8'))";
                break;
            case 'HS3A':
            case 'HS3B':
            case 'HS4A':
            case 'HS4B':
            case 'HS5A':
                sqlCondition += " or (line == '" + line + "' and machineName has_any('PRINTER','SPI','REFLOW','AOI') and (machineName startswith 'CM' or machineName startswith 'DT' or machineName startswith 'NPM') and (machineName endswith '-1' or machineName endswith '-2' or machineName endswith '-3' or machineName endswith '-4' or machineName endswith '-5' or machineName endswith '-6'))";
                break;
            case 'HP2':
            case 'HP3':
                sqlCondition += " or (line == '" + line + "' and machineName has_any('ATE','AUTO LABELER','FICT','UN-FILL1','UN-FILL2','UNREFLOW','AUTO INSTALLER','INLINE ROUTER','AUTO PACKING'))";
                break;
            case 'HP4':
                sqlCondition += " or (line == '" + line + "' and machineName has_any('ATE','AUTO LABELER','FICT','UN-FILL1','UN-FILL2','UNREFLOW','AUTO INSTALLER','INLINE ROUTER'))";
                break;
            case 'HP5':
                sqlCondition += " or (line == '" + line + "' and machineName has_any('ATE','AUTO LABELER','UN-FILL1','UN-FILL2','UNREFLOW','AUTO INSTALLER','INLINE ROUTER'))";
                break;

            default:
        }
    });
    sqlCondition += " );";
    sqlCondition += " resultTable|summarize duration_sum = sum(Duration) by line, color";
    result = sqlMain + sqlCondition;
    console.log("pcba3color_duration:" + result);
    return result;
}
function generateKSQL4SMTCT(plant, lines, dts, dte) {
    var result = "";
    var sqlMain = "";
    var sqlCondition = "";
    var lines_array = lines.split(",");

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
    result = sqlMain + sqlCondition;
    console.log("smtcycletime2:" + result);
    return result;
}

//howard
app.use("/PCBA/getkvmREFLOWOxygen/:timestampFrom/:timestampTo/:plant/:line/:machineNames/:timeInterval", async (req, res) => {
    //測試網址：http://localhost:3001/PCBA/getkvmREFLOWOxygen/1597127400000/1597136400000/F232/HS6/REFLOW/5m
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName;
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        // 標記:正式機
        // var p_timestampFrom = new Date(eval(req.params.timestampFrom));
        // 標記:測試機
        // var p_timestampFrom = new Date(1584840186000);
        // var p_timestampTo = new Date(eval(req.params.timestampTo + 1));
        var p_timestampFrom =  req.params.timestampFrom;

        if(p_timestampFrom % 300000 != 0){
            p_timestampFrom = p_timestampFrom - p_timestampFrom % 300000;
        }

        var p_timestampTo = req.params.timestampTo;
        if(p_timestampTo % 300000 != 0){
            p_timestampTo = p_timestampTo - p_timestampTo % 300000 + 300000;
        }
        var p_plant = req.params.plant;
        var p_line = req.params.line;
       
        var tmp_machineNames = req.params.machineNames;
        var p_machineNames = '';
        var p_timeInterval = req.params.timeInterval;
        var p_num= p_timeInterval.replace(/[^0-9]/ig,"");

        console.log(p_num*60*1000);
      
        
        for (var i = 0; i < tmp_machineNames.split(',').length; i++) {
            p_machineNames += "'" + tmp_machineNames.split(',')[i] + "',"
        }

        if (p_machineNames.endsWith(',')) {
            p_machineNames = p_machineNames.substr(0, p_machineNames.length - 1);
        }
        
        let ksql = `
        kvm_reflow
        | where plant == '@PLANT' and line =='@LINE' and machineName in (@MACHINENAME)
        | where evt_dt between (@TIME_FROM .. @TIME_TO)
        | project  evt_dt,O2PPM
        | make-series o2ppm=avg(O2PPM) default=0 on evt_dt from @TIME_FROM to @TIME_TO step @NUM
        `;
        ksql = ksql.replace(/@PLANT/gi, p_plant);
        ksql = ksql.replace(/@LINE/gi, p_line);
        ksql = ksql.replace(/@MACHINENAME/gi, p_machineNames );
        ksql = ksql.replace(/@TIME_FROM/gi, p_timestampFrom );
        ksql = ksql.replace(/@TIME_TO/gi, p_timestampTo);
        ksql = ksql.replace(/@NUM/gi, p_num*60*1000);
        

        console.log('要執行的KSQL語句:',ksql);
        // 指定data base        
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                response= JSON.parse(results.primaryResults[0].toString());
                var result = '';
                result = '{';
                result += '"took":999999,';
                result += '"hits":{"total":999999,"hits":[]},';
                result += '"aggregations":{';
                result += '"terms_based":{';
                result += '"buckets":[';
                for (let i = 0; i < response.data[0].o2ppm.length; i++) {

                        m = new Date(response.data[0].evt_dt[i]);
                        d = m.getMinutes();
                        // m.setMinutes(d-1);
                        var hour; var min;
                        if(m.getHours() < 10) hour = "0" + m.getHours();
                        else  hour = m.getHours();

                        if(m.getMinutes() < 10) min = "0" + m.getMinutes();
                        else  min = m.getMinutes();


                        let a ={
                            "key_as_string": hour+':'+min,
                            "key":response.data[0].evt_dt[i],
                            "o2ppm": {
                                "value": response.data[0].o2ppm[i]
                              }

                        };
             
                        if (i == (response.data[0].o2ppm.length - 1)) 
                        {  
                            result=result+JSON.stringify(a);
                        }else{
                            result=result+JSON.stringify(a)+',';
                            
                        }
                }
                result += ']';
                result += '}';
                result += '}';
                result += '}';
          
                console.log(JSON.parse(result));
                res.send(JSON.parse(result));
            }
        });        
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});
app.use("/PCBA/getkvmREFLOWWater/:timestampFrom/:timestampTo/:plant/:line/:machineNames/:timeInterval", async (req, res) => {
    //測試網址：http://localhost:3001/PCBA/getkvmREFLOWWater/1597127400000/1597136400000/F232/HS6/REFLOW/5m
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName;
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        // 標記:正式機
        // var p_timestampFrom = new Date(eval(req.params.timestampFrom));
        // 標記:測試機
        // var p_timestampFrom = new Date(1584840186000);
        // var p_timestampTo = new Date(eval(req.params.timestampTo + 1));
        var p_timestampFrom =  req.params.timestampFrom;

        if(p_timestampFrom % 300000 != 0){
            p_timestampFrom = p_timestampFrom - p_timestampFrom % 300000;
        }

        var p_timestampTo = req.params.timestampTo;
        if(p_timestampTo % 300000 != 0){
            p_timestampTo = p_timestampTo - p_timestampTo % 300000 +300000;
        }
        var p_plant = req.params.plant;
        var p_line = req.params.line;
       
        var tmp_machineNames = req.params.machineNames;
        var p_machineNames = '';
        var p_timeInterval = req.params.timeInterval;
        var p_num= p_timeInterval.replace(/[^0-9]/ig,"");

        console.log(p_num*60*1000);
      
        
        for (var i = 0; i < tmp_machineNames.split(',').length; i++) {
            p_machineNames += "'" + tmp_machineNames.split(',')[i] + "',"
        }

        if (p_machineNames.endsWith(',')) {
            p_machineNames = p_machineNames.substr(0, p_machineNames.length - 1);
        }
//let tmpDt = 
// (
//     kvm_reflow
//     | where plant == 'F232' and line =='HS6' and machineName == 'REFLOW' 
//     | where evt_dt between (1597127400000 .. 1597136400000)
//     | project  plant,evt_dt,O2PPM
// );
// tmpDt
// | make-series avg(O2PPM) default=0 on evt_dt from 1597127400000 to 1597136400000 step 300000 

        let ksql = `
        kvm_reflow
        | where plant == '@PLAT' and line =='@LINE' and machineName in (@MACHINENAME)
        | where evt_dt between (@TIME_FROM .. @TIME_TO)
        | project  evt_dt,WaterTempW1
        | make-series WT=avg(WaterTempW1) default=0 on evt_dt from @TIME_FROM to @TIME_TO step @NUM
        `;
        ksql = ksql.replace(/@PLAT/gi, p_plant);
        ksql = ksql.replace(/@LINE/gi, p_line);
        ksql = ksql.replace(/@MACHINENAME/gi, p_machineNames );
        ksql = ksql.replace(/@TIME_FROM/gi, p_timestampFrom );
        ksql = ksql.replace(/@TIME_TO/gi, p_timestampTo);
        ksql = ksql.replace(/@NUM/gi, p_num*60*1000);
        

        console.log('要執行的KSQL語句:',ksql);
        // 指定data base        
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                // console.log(results.primaryResults[0].toString());
                response= JSON.parse(results.primaryResults[0].toString());
                // response.data[0].o2ppm.forEach(i=>{
                //     console.log(i);
                // });
                // response.data[0].evt_dt.forEach(i=>{
                //     console.log(i);
                // });
                // console.log(response.data[0].o2ppm.length);
                // console.log(response.data[0].evt_dt.length);
                var result = '';
                result = '{';
                result += '"took":999999,';
                result += '"hits":{"total":999999,"hits":[]},';
                result += '"aggregations":{';
                result += '"terms_based":{';
                result += '"buckets":[';
                for (let i = 0; i < response.data[0].WT.length; i++) {

                        m = new Date(response.data[0].evt_dt[i]);
                        d = m.getMinutes();
                        // m.setMinutes(d-1);
                        var hour; var min;
                        if(m.getHours() < 10) hour = "0" + m.getHours();
                        else  hour = m.getHours();

                        if(m.getMinutes() < 10) min = "0" + m.getMinutes();
                        else  min = m.getMinutes();


                        let a ={
                            "key_as_string": hour+':'+min,
                            "key":response.data[0].evt_dt[i],
                            "water_temp": {
                                "value": response.data[0].WT[i]
                              }

                        };
             
                        if (i == (response.data[0].WT.length - 1)) 
                        {  
                            result=result+JSON.stringify(a);
                        }else{
                            result=result+JSON.stringify(a)+',';
                            
                        }
                }
                result += ']';
                result += '}';
                result += '}';
                result += '}';
          
                console.log(JSON.parse(result));
                res.send(JSON.parse(result));
            }
        });        
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});



app.use("/PCBA/getMachineNameDurationByShiftHour/:timestampFrom/:timestampTo/:line/:machineNames", async (req, res) => {
    // 測試網址：http://localhost:3001/PCBA/getMachineNameDurationByShiftHour/1593388800000/1593431999999/HSA/SPI,SPI
    // 模仿 es 的回傳
    // 標記 : 模仿 es 的回傳
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName;

        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );

        const client = new KustoClient(kcsb);
        var p_timestampFrom = new Date(eval(req.params.timestampFrom));
        var p_timestampTo = new Date(eval(req.params.timestampTo + 1));
        var p_line = req.params.line;
        var tmp_machineNames = req.params.machineNames;
        var p_machineNames = '';
        for (var i = 0; i < tmp_machineNames.split(',').length; i++) {
            p_machineNames += "'" + tmp_machineNames.split(',')[i] + "',"
        }

        if (p_machineNames.endsWith(',')) {
            p_machineNames = p_machineNames.substr(0, p_machineNames.length - 1);
        }

        /* plant == 'F232' and */
        let ksql = `
    let interval = 1hr;
    let stime = datetime('@A_DATE_START');
    let etime = datetime('@A_DATE_END');
    pcba3color_duration
    | where  line =='@LINE' and machineName in (@MACHINE_Arr_string) and unixtime_milliseconds_todatetime(evt_dt) >= stime and unixtime_milliseconds_todatetime(evt_dt) < etime
    | project evt_date_ymdh = format_datetime(unixtime_milliseconds_todatetime(evt_dt),'yyyy-MM-dd HH'),evt_dt,plant,line,model,machineName,color,changetime,Duration
    | summarize Duration = sum(Duration) by color,evt_date_ymdh,plant,line,model,machineName
    | order by evt_date_ymdh asc ,color
    `;
    console.log(1);
        // 標記:正式機
        // ksql = ksql.replace(/@A_DATE_START/gi, p_timestampFrom.getFullYear()+'-'+(p_timestampFrom.getMonth()+1)+'-'+ p_timestampFrom.getDate() + ' ' + p_timestampFrom.getHours() + ':00:00' );
        // ksql = ksql.replace(/@A_DATE_END/gi,new Date(eval(req.params.timestampTo )).getFullYear()+'-'+(new Date(eval(req.params.timestampTo )).getMonth()+1)+'-'+ new Date(eval(req.params.timestampTo )).getDate() + ' ' + new Date(eval(req.params.timestampTo )).getHours()+':59:59');

        // 標記:測試機        
        ksql = ksql.replace(/@A_DATE_START/gi, '2020-04-22' + ' ' + p_timestampFrom.getHours() + ':00:00' );
        ksql = ksql.replace(/@A_DATE_END/gi, '2020-04-22' + ' ' + new Date(eval(req.params.timestampTo )).getHours()+':59:59');

        

        ksql = ksql.replace(/@LINE/gi, p_line);
        ksql = ksql.replace(/@MACHINE_Arr_string/gi, p_machineNames);
       

        console.log(ksql);
        // 指定data base
        console.log(process.env.KUSTODBNAME)
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                // mark模仿 es 的回傳
                let esResult = '';
                esResult = '{';
                esResult += '"took":999999,';
                esResult += '"hits":{"total":999999,"hits":[]},';
                esResult += '"aggregations":{';
                esResult += '"terms_based":{';
                esResult += '"buckets":[';
               
                var tmp = JSON.parse(results.primaryResults[0]);

                var tmp_hash_time = [];
                for (var idx = 0; idx < tmp.data.length; idx++) {
                    tmp.data[idx].evt_date_ymdh = tmp.data[idx].evt_date_ymdh + ':00';
                }
                for (var idx = 0; idx < tmp.data.length; idx++) {
                    if (tmp_hash_time.indexOf(tmp.data[idx].evt_date_ymdh) >= 0) {
                        continue;
                    }
                    esResult += '{';
                    var tmp_date_start = new Date(tmp.data[idx].evt_date_ymdh);
                    var tmp_date_end = new Date(tmp_date_start.getTime() + (60 * 60000) - 1);
                    // esResult += '"key":"' + tmp.data[idx].evt_date_ymdh+'",';
                    esResult += '"key":"' + tmp_date_start.getFullYear() + "-" + (tmp_date_start.getMonth() + 1) + "-" + tmp_date_start.getDate() + "T" + tmp_date_start.getHours() + ":00:00.000Z-";
                    esResult += tmp_date_end.getFullYear() + "-" + (tmp_date_end.getMonth() + 1) + "-" + tmp_date_end.getDate() + "T" + tmp_date_end.getHours() + ":59:59.999Z" + '",';
                    esResult += '"from":' + tmp_date_start.getTime() + ',';
                    // tmp_date_start.getFullYear()+"-"+(tmp_date_start.getMonth()+1)+"-"+tmp_date_start.getDate()+"T"+tmp_date_start.getHours()+":00.000Z-"

                    tmp_hash_time.push(tmp.data[idx].evt_date_ymdh);
                    esResult += '"from_as_string":"' + tmp_date_start.getFullYear() + "-" + (tmp_date_start.getMonth() + 1) + "-" + tmp_date_start.getDate() + "T" + tmp_date_start.getHours() + ":00:00.000Z" + '",';
                    esResult += '"to":' + tmp_date_end.getTime() + ',';
                    esResult += '"to_as_string":"' + tmp_date_end.getFullYear() + "-" + (tmp_date_end.getMonth() + 1) + "-" + tmp_date_end.getDate() + "T" + tmp_date_end.getHours() + ":59:59.999Z" + '",';
                    esResult += '"doc_count":999999,';
                    esResult += '"color":{';
                    esResult += '"buckets":[';
                    // Gray
                    esResult += '{';
                    esResult += '"key":"Gray",';
                    var tmp_doc_count = 0;
                    var tmp_value = 0;
                    for (var idx_tmp = 0; idx_tmp < tmp.data.length; idx_tmp++) {
                        if (tmp.data[idx_tmp].evt_date_ymdh == tmp.data[idx].evt_date_ymdh && tmp.data[idx].color == 'Gray') {
                            tmp_doc_count += 1;
                            tmp_value = tmp.data[idx].Duration
                        }
                    }
                    esResult += '"doc_count":' + tmp_doc_count + ',';
                    esResult += '"duration_sum":{';
                    esResult += '"value":' + tmp_value;
                    esResult += '}';
                    esResult += '},';

                    // Green
                    esResult += '{';
                    esResult += '"key":"Green",';
                    var tmp_doc_count = 0;
                    var tmp_value = 0;
                    for (var idx_tmp = 0; idx_tmp < tmp.data.length; idx_tmp++) {
                        if (tmp.data[idx_tmp].evt_date_ymdh == tmp.data[idx].evt_date_ymdh && tmp.data[idx].color == 'Green') {
                            tmp_doc_count += 1;
                            tmp_value = tmp.data[idx].Duration
                        }
                    }
                    esResult += '"doc_count":' + tmp_doc_count + ',';
                    esResult += '"duration_sum":{';
                    esResult += '"value":' + tmp_value;
                    esResult += '}';
                    esResult += '},';

                    // Red
                    esResult += '{';
                    esResult += '"key":"Red",';
                    var tmp_doc_count = 0;
                    var tmp_value = 0;
                    for (var idx_tmp = 0; idx_tmp < tmp.data.length; idx_tmp++) {
                        if (tmp.data[idx_tmp].evt_date_ymdh == tmp.data[idx].evt_date_ymdh && tmp.data[idx].color == 'Red') {
                            tmp_doc_count += 1;
                            tmp_value = tmp.data[idx].Duration
                        }
                    }
                    esResult += '"doc_count":' + tmp_doc_count + ',';
                    esResult += '"duration_sum":{';
                    esResult += '"value":' + tmp_value;
                    esResult += '}';
                    esResult += '},';

                    // Yellow
                    esResult += '{';
                    esResult += '"key":"Yellow",';
                    var tmp_doc_count = 0;
                    var tmp_value = 0;
                    for (var idx_tmp = 0; idx_tmp < tmp.data.length; idx_tmp++) {
                        if (tmp.data[idx_tmp].evt_date_ymdh == tmp.data[idx].evt_date_ymdh && tmp.data[idx].color == 'Yellow') {
                            tmp_doc_count += 1;
                            tmp_value = tmp.data[idx].Duration
                        }
                    }
                    esResult += '"doc_count":' + tmp_doc_count + ',';
                    esResult += '"duration_sum":{';
                    esResult += '"value":' + tmp_value;
                    esResult += '}';
                    esResult += '}';

                    esResult += ']';
                    esResult += '}';
                    esResult += '},';

                }
                if (esResult.endsWith(',')) {
                    esResult = esResult.substr(0, esResult.length - 1);
                }
                esResult += ']';
                esResult += '}';
                esResult += '}';
                esResult += '}';

                console.log(results.primaryResults[0].toString());

                console.log('--------------------------------')

                console.log(esResult)
                let test = JSON.parse(esResult);
                // res.send(JSON.parse(results.primaryResults[0]));
                res.send(JSON.parse(esResult));

                `
            {
                "name": "PrimaryResult",
                "data": [
                  {
                    "color": "Yellow",
                    "evt_date_ymdh": "2020-04-22 00",
                    "plant": "F232",
                    "line": "HS8",
                    "model": "INDIGO",
                    "machineName": "SPI",
                    "Duration": 6000
                  },
            `
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.use("/PCBA/getCapacity/:timestampFrom/:timestampTo/:plant/:lines/:machineNames", async (req, res) => {
    //測試網址：http://localhost:3001/PCBA/getCapacity/1584840186000/1584921599999/F232/HSB/SPI,SPI
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName;
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        // 標記:正式機
        // var p_timestampFrom = new Date(eval(req.params.timestampFrom));
        // 標記:測試機
        var p_timestampFrom = new Date(1584840186000);
        var p_timestampTo = new Date(eval(req.params.timestampTo + 1));
        var p_plant = req.params.plant;
        var tmp_lines = req.params.lines;
        var p_lines = '';
        var tmp_machineNames = req.params.machineNames;
        var p_machineNames = '';

        for (var i = 0; i < tmp_lines.split(',').length; i++) {
            p_lines += "'" + tmp_lines.split(',')[i] + "',"
        }

        if (p_lines.endsWith(',')) {
            p_lines = p_lines.substr(0, p_lines.length - 1);
        }
        
        for (var i = 0; i < tmp_machineNames.split(',').length; i++) {
            p_machineNames += "'" + tmp_machineNames.split(',')[i] + "',"
        }

        if (p_machineNames.endsWith(',')) {
            p_machineNames = p_machineNames.substr(0, p_machineNames.length - 1);
        }

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

        if (p_lines.length == 0) {
            ksql = ksql.replace(/and line in (@LINE)/gi, '');
        } else {
            ksql = ksql.replace(/@LINE/gi, p_lines);
        }

        if (p_machineNames.length == 0) {
            ksql = ksql.replace(/and machineName in (@MACHINE_NAMES)/gi, '');
        } else {
            ksql = ksql.replace(/@MACHINE_NAMES/gi, p_machineNames);
        }
        console.log('要執行的KSQL語句:',ksql);
        // 指定data base        
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());
                res.send(JSON.parse(results.primaryResults[0].toString()));
            }
        });        
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.use("/PCBA/getSpiYR/:timestampFrom/:timestampTo/:plant/:line/:machineNames", async (req, res) => {
    // 測試網址：http://localhost:3001/PCBA/getSpiYR/1584840186000/1584921599999/F232/HSB/SPI,SPI
    // 模仿 es 的回傳
    // 標記 : 模仿 es 的回傳
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName;
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );

        const client = new KustoClient(kcsb);
        // 變量說明
        var p_timestampFrom = new Date(eval(req.params.timestampFrom));
        var p_timestampTo = new Date(eval(req.params.timestampTo + 1));
        var p_line = req.params.line;
        var p_plant = req.params.plant;
        var tmp_machineNames = req.params.machineNames;
        var p_machineNames = '';
        var arr_time_range = [];
        var arr_all_location = [];
        var arr_all_defectCode = [];

        // machine 拆解 到 p_machineNames
        for (var i = 0; i < tmp_machineNames.split(',').length; i++) {
            p_machineNames += "'" + tmp_machineNames.split(',')[i] + "',"
        }
        if (p_machineNames.endsWith(',')) {
            p_machineNames = p_machineNames.substr(0, p_machineNames.length - 1);
        }

        // 標記要調整:時間區段
        // 設定時間區段,可以調整這邊的區段，將直接影響產生的資料
        for (var tmp = 0; tmp < 24; tmp++) {
            var tmpTimeObj = {
                start: undefined,
                end: undefined,
                start_dt: undefined,
                end_dt: undefined
            };
            var tmpStart = new Date(p_timestampFrom.getTime() + (tmp * 60 * 60000));
            var tmpEnd = new Date(p_timestampFrom.getTime() + ((tmp + 1) * 60 * 60000) - 1);
            tmpTimeObj.start = tmpStart.getTime();
            tmpTimeObj.end = tmpEnd.getTime();
            tmpTimeObj.start_dt = tmpStart;
            tmpTimeObj.end_dt = tmpEnd;
            arr_time_range.push(tmpTimeObj);
        }
        // 顯示時間區段
        // console.log(arr_time_range);


        let ksql = `
        let interval = 1hr;
        let stime = datetime('@A_DATE_START');
        let etime = datetime('@A_DATE_END');
        spicsv
        | where plant == '` + p_plant + `' and line =='` + p_line + `' and machineName in (` + p_machineNames + `) 
        | project usn,defectCode,evt_dt,evt_date_ymdh = format_datetime(unixtime_milliseconds_todatetime(evt_dt),'yyyy-MM-dd HH'),IsOK,evt_tp,line,plant,model,location,machineName,evt_ns
        | where evt_dt >= 1584838800000 and evt_dt <= 1584878399999 
        `;
        // region E

        // endregion

        // 標記:正式機
        ksql = ksql.replace(/@A_DATE_START/gi,p_timestampFrom.getFullYear()+'-'+(p_timestampFrom.getMonth()+1)+'-'+p_timestampFrom.getDate());
        ksql = ksql.replace(/@A_DATE_END/gi,p_timestampTo.getFullYear()+'-'+(p_timestampTo.getMonth()+1)+'-'+p_timestampTo.getDate());
        // 標記:測試機
        // ksql = ksql.replace(/@A_DATE_START/gi, '2020-03-22');
        // ksql = ksql.replace(/@A_DATE_END/gi, '2020-03-23');
        


        console.log(ksql);
        // 指定data base
        console.log(process.env.KUSTODBNAME)

        var esMainObj = {
            "took": 50,
            "timed_out": false,
            "_shards": {
                "total": 61,
                "successful": 61,
                "skipped": 0,
                "failed": 0
            },
            "hits": {
                "total": 52898,
                "max_score": 0.0,
                "hits": []
            },
            "aggregations": {
                "terms_based": {
                    "buckets": []
                },
                "ng": {
                    defect_code: {
                        buckets: []
                    },
                    location: {
                        buckets: []
                    },
                }
            }
        };
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                var drs_all = JSON.parse(results.primaryResults[0]).data;
                // 取得所有的 defecCode 欄位資訊
                drs_all.forEach(item => {
                    if (arr_all_defectCode.indexOf(item.defectCode) >= 0) {

                    } else {
                        arr_all_defectCode.push(item.defectCode);
                    }
                });
                // 取得所有的 location 欄位資訊
                drs_all.forEach(item => {
                    if (arr_all_location.indexOf(item.location) >= 0) {

                    } else {
                        arr_all_location.push(item.location);
                    }
                });


                for (var tmpIdx = 0; tmpIdx < arr_time_range.length; tmpIdx++) {
                    var tmpCurrTime = arr_time_range[tmpIdx];
                    var tmpItemObj = {
                        key: '',
                        from: '',
                        from_as_string: '',
                        to: '',
                        to_as_string: '',
                        doc_count: '',
                        ng: {
                            doc_count: 0,
                            usn: {
                                value: 0
                            },
                            defect_code: {
                                doc_count_error_upper_bound: 0,
                                sum_other_doc_count: 0,
                                buckets: []
                            },
                            location: {
                                doc_count_error_upper_bound: 0,
                                sum_other_doc_count: 0,
                                buckets: []
                            }
                        },
                        ok: {
                            doc_count: 0
                        }
                    };



                    tmpItemObj.key = tmpCurrTime.start_dt.getFullYear() + "-" + (tmpCurrTime.start_dt.getMonth() + 1) + "-" + tmpCurrTime.start_dt.getDate() + "T" + tmpCurrTime.start_dt.getHours() + ":00:00.000Z-";
                    tmpItemObj.key += tmpCurrTime.end_dt.getFullYear() + "-" + (tmpCurrTime.end_dt.getMonth() + 1) + "-" + tmpCurrTime.end_dt.getDate() + "T" + tmpCurrTime.end_dt.getHours() + ":59:59.999Z";
                    tmpItemObj.from = tmpCurrTime.start;
                    tmpItemObj.to = tmpCurrTime.end;
                    tmpItemObj.from_as_string = tmpCurrTime.start_dt.getFullYear() + "-" + (tmpCurrTime.start_dt.getMonth() + 1) + "-" + tmpCurrTime.start_dt.getDate() + "T" + tmpCurrTime.start_dt.getHours() + ":00:00.000Z";
                    tmpItemObj.to_as_string = tmpCurrTime.end_dt.getFullYear() + "-" + (tmpCurrTime.end_dt.getMonth() + 1) + "-" + tmpCurrTime.end_dt.getDate() + "T" + tmpCurrTime.end_dt.getHours() + ":59:59.999Z";

                    var _docCount = 0;
                    drs_all.forEach(item => {
                        if (item.evt_dt >= tmpCurrTime.start && item.evt_dt <= tmpCurrTime.end) {
                            _docCount += 1;
                        }
                    });
                    tmpItemObj.doc_count = _docCount;

                    // 處理 ng 欄位

                    tmpItemObj.ng.doc_count = 0;
                    drs_all_filter = [];
                    drs_all.forEach(item => {
                        if (item.evt_dt >= tmpCurrTime.start && item.evt_dt <= tmpCurrTime.end) {
                            drs_all_filter.push(item);
                        }
                    });

                    // ng count 
                    var _ng_count = 0;
                    var _ok_count = 0;
                    drs_all_filter.forEach(item => {
                        if (item.IsOK == 0) {
                            _ng_count += 1;
                        } else {
                            _ok_count += 1;
                        }
                    })
                    // console.log(_ng_count);
                    // console.log(_ok_count);
                    tmpItemObj.ng.doc_count = _ng_count;
                    tmpItemObj.ok.doc_count = _ok_count;

                    // tmpItemObj.ng.usn.value 先跳過看前端是是否有使用到

                    arr_all_defectCode.forEach(item => {
                        var _defect_code_obj = {
                            key: '',
                            doc_count: 0,
                            location: {
                                doc_count_error_upper_bound: 0,
                                sum_other_doc_count: 0,
                                buckets: []
                            }
                        };

                        _defect_code_obj.key = item;


                        drs_all_filter.forEach(item_data => {
                            if (item == item_data.defectCode) {
                                _defect_code_obj.doc_count += 1;
                            }
                        });

                        drs_all_defectcode_filter = [];
                        drs_all_filter.forEach(item_data => {
                            if (item == item_data.defectCode) {
                                drs_all_defectcode_filter.push(item);
                            }
                        });

                        // 開始區分location 
                        _defect_code_obj.location = {
                            doc_count_error_upper_bound: 0,
                            sum_other_doc_count: 0,
                            buckets: []
                        };

                        arr_all_location.forEach(itemLocation => {
                            var _locationObj = {
                                key: itemLocation,
                                doc_count: 0
                            };

                            if (itemLocation == drs_all_filter.location) {
                                _locationObj.doc_count += 1;
                            }

                            _defect_code_obj.location.buckets.push(_locationObj);
                        });
                        // ng.defect_code.buckets
                        tmpItemObj.ng.defect_code.buckets.push(_defect_code_obj);
                    });

                    // ng.defect_code.location.buckets

                    arr_all_location.forEach(item => {
                        var _location_obj = {
                            key: '',
                            doc_count: 0,
                            defect_code: {
                                doc_count_error_upper_bound: 0,
                                sum_other_doc_count: 0,
                                buckets: []
                            }
                        };

                        _location_obj.key = item;


                        drs_all_filter.forEach(item_data => {
                            if (item == item_data.location) {
                                _location_obj.doc_count += 1;
                            }
                        });

                        drs_all_location_filter = [];
                        drs_all_filter.forEach(item_data => {
                            if (item == item_data.location) {
                                drs_all_location_filter.push(item);
                            }
                        });

                        // 開始區分defect_code 
                        _location_obj.defect_code = {
                            doc_count_error_upper_bound: 0,
                            sum_other_doc_count: 0,
                            buckets: []
                        };

                        arr_all_defectCode.forEach(itemDefectCode => {
                            var _locationObj = {
                                key: itemDefectCode,
                                doc_count: 0
                            };

                            if (itemDefectCode == drs_all_filter.defect_code) {
                                _locationObj.doc_count += 1;
                            }

                            _location_obj.defect_code.buckets.push(_locationObj);
                        });
                        // ng.defect_code.buckets
                        tmpItemObj.ng.location.buckets.push(_location_obj);

                    });
                    esMainObj.aggregations.terms_based.buckets.push(tmpItemObj);
                    //esMainObj.aggregations.ng.buckets.push(tmpItemObj);
                    // console.log(tmpItemObj);
                }

                // ng
                var drs_all_ng = [];
                drs_all.forEach(itemNg => {
                    if (itemNg.ISOK == 0) {
                        drs_all_ng.push(itemNg);
                    }
                });

                var itemNgMain = {
                    doc_count: 0,
                    defect_code: {
                        doc_count_error_upper_bound: 0,
                        sum_other_doc_count: 0,
                        buckets: []
                    },
                    location: {
                        doc_count_error_upper_bound: 0,
                        sum_other_doc_count: 0,
                        buckets: []
                    }
                }

                itemNgMain.doc_count = drs_all_ng.length;
                arr_all_defectCode.forEach(tmp_defectCode => {
                    var subItemMain = {
                        "key": '',
                        "doc_count": 0,
                        "location": {
                            doc_count_error_upper_bound: 0,
                            sum_other_doc_count: 0,
                            buckets: []
                        }
                    };
                    subItemMain.key = tmp_defectCode;
                    var drs_all_ng_filter = [];
                    drs_all_ng.forEach(tmp => {
                        if (tmp.defect_code == tmp_defectCode) {
                            subItemMain.doc_count += 1;
                            drs_all_ng_filter.push(tmp);
                        }
                    });



                    arr_all_location.forEach(tmp_location => {
                        var tmp_obj_location = {
                            key: '',
                            doc_count: 0
                        };
                        tmp_obj_location.key = tmp_location;
                        drs_all_ng_filter.forEach(drNgItem => {

                            if (tmp_location == drNgItem.location) {
                                tmp_obj_location.doc_count += 1;
                            }
                        });
                        subItemMain.location.buckets.push(tmp_obj_location);
                    });

                    esMainObj.aggregations.ng.defect_code.buckets.push(subItemMain);


                });

                // esMainObj.aggregations.ng.location [Start]
                itemNgMain.doc_count = drs_all_ng.length;
                arr_all_location.forEach(tmp_location => {
                    var subItemMain = {
                        "key": '',
                        "doc_count": 0,
                        "defect_code": {
                            doc_count_error_upper_bound: 0,
                            sum_other_doc_count: 0,
                            buckets: []
                        }
                    };
                    subItemMain.key = tmp_location;
                    var drs_all_ng_filter = [];
                    drs_all_ng.forEach(tmp => {
                        if (tmp.location == tmp_location) {
                            subItemMain.doc_count += 1;
                            drs_all_ng_filter.push(tmp);
                        }
                    });





                    arr_all_defectCode.forEach(tmp_defectCode => {
                        var tmp_obj_defectCode = {
                            key: '',
                            doc_count: 0
                        };
                        tmp_obj_defectCode.key = tmp_defectCode;
                        drs_all_ng_filter.forEach(drNgItem => {

                            if (tmp_defectCode == drNgItem.defect_code) {
                                tmp_obj_defectCode.doc_count += 1;
                            }
                        });
                        subItemMain.defect_code.buckets.push(tmp_obj_defectCode);
                    });

                    esMainObj.aggregations.ng.location.buckets.push(subItemMain);


                });


                // console.log(arr_all_location);
                // console.log(arr_all_defectCode);



                res.send(esMainObj);
            }
        });
        return;
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

//==============================pcba_defect_20*=======================================
//因為回傳是空直  所以無法測試重組資料, 要先去其他function觀察修改方式, 之後再回來修
app.get("/PCBA/defect/:timestampFrom/:timestampTo/:lines",async (req, res) =>
{
    let lines_array = typeof req.params.lines === "string" ?  req.params.lines : req.params.lines.join(',');
    let p_timestampFrom = new Date(eval(req.params.timestampFrom));
    let p_timestampTo = new Date(eval(req.params.timestampTo + 1));
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        // res.send(req.params.name)

        // var ksql = generateKSQL4PCBA3COLORDURATION(req.body.plant, req.body.line, req.body.evt_dt_from, req.body.evt_dt_to);

        ksql = "let mainTable = materialize (pcba_defect| where line in ('" + req.params.lines + "') and (evt_dt >= " + req.params.timestampFrom + " and evt_dt < " + req.params.timestampTo + "));"
        ksql+= "let resultTable =  materialize(mainTable| top 5 by reasonen desc ); resultTable|top 1 by reasoncode desc";
    
        console.log(`ADE query : ${ksql}`);

        //指定data base:test-db
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());
                res.send(JSON.parse(results.primaryResults[0]));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

app.use("/PCBA/getPcba3ColorDuration_SumDuration_Color/:timestampFrom/:timestampTo/:plant/:line/:machineNames", async (req, res) => {
    //測試網址：http://localhost:3001/PCBA/getPcba3ColorDuration_SumDuration_Color/1596758400000/1596844799000/F232/HS6/AOI1
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName;
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        // 標記:正式機
        // var p_timestampFrom = new Date(eval(req.params.timestampFrom));
        // 標記:測試機
        // var p_timestampFrom = new Date(1584840186000);
        // var p_timestampTo = new Date(eval(req.params.timestampTo + 1));
        var p_timestampFrom =  req.params.timestampFrom;
        var p_timestampTo = req.params.timestampTo;
        var p_plant = req.params.plant;
        var p_line = req.params.line;
       
        var tmp_machineNames = req.params.machineNames;
        var p_machineNames = '';

      
        
        for (var i = 0; i < tmp_machineNames.split(',').length; i++) {
            p_machineNames += "'" + tmp_machineNames.split(',')[i] + "',"
        }

        if (p_machineNames.endsWith(',')) {
            p_machineNames = p_machineNames.substr(0, p_machineNames.length - 1);
        }

        let ksql = `
        pcba3color_duration
        | where plant == '@PLAT' and line =='@LINE' and machineName == @MACHINENAME and evt_dt >= @TIME_FROM and evt_dt <= @TIME_TO
        | summarize  duration_sum = sum(Duration) by color
        | order by color asc
        `;
        ksql = ksql.replace(/@PLAT/gi, p_plant);
        ksql = ksql.replace(/@LINE/gi, p_line);
        ksql = ksql.replace(/@MACHINENAME/gi, p_machineNames );
        ksql = ksql.replace(/@TIME_FROM/gi, p_timestampFrom );
        ksql = ksql.replace(/@TIME_TO/gi, p_timestampTo);
        

        console.log('要執行的KSQL語句:',ksql);
        // 指定data base        
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());
                res.send(JSON.parse(results.primaryResults[0].toString()));
            }
        });        
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});




app.use("/PCBA/getPcbaAoi_aggResult/:timestampFrom/:timestampTo/:plant/:line/:machineNames", async (req, res) => {
    //測試網址：http://localhost:3001/PCBA/getPcbaAoi_aggResult/1596758400000/1596844799000/F232/HS6/AOI1
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName;
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        // 標記:正式機
        // var p_timestampFrom = new Date(eval(req.params.timestampFrom));
        // 標記:測試機
        // var p_timestampFrom = new Date(1584840186000);
        // var p_timestampTo = new Date(eval(req.params.timestampTo + 1));
        var p_timestampFrom =  req.params.timestampFrom;
        var p_timestampTo = req.params.timestampTo;
        var p_plant = req.params.plant;
        var p_line = req.params.line;
       
        var tmp_machineNames = req.params.machineNames;
        var p_machineNames = '';

      
        
        for (var i = 0; i < tmp_machineNames.split(',').length; i++) {
            p_machineNames += "'" + tmp_machineNames.split(',')[i] + "',"
        }

        if (p_machineNames.endsWith(',')) {
            p_machineNames = p_machineNames.substr(0, p_machineNames.length - 1);
        }

        let ksql = `
        pcba_aoi
        | where plant == '@PLAT' and line =='@LINE' and machineName == @MACHINENAME and evt_dt >= @TIME_FROM and evt_dt <= @TIME_TO
        | summarize count() by result
        `;
        ksql = ksql.replace(/@PLAT/gi, p_plant);
        ksql = ksql.replace(/@LINE/gi, p_line);
        ksql = ksql.replace(/@MACHINENAME/gi, p_machineNames );
        ksql = ksql.replace(/@TIME_FROM/gi, p_timestampFrom );
        ksql = ksql.replace(/@TIME_TO/gi, p_timestampTo);
        

        console.log('要執行的KSQL語句1:',ksql);
        let drs_result = [];
        let drs_locations_result = []
        // 指定data base        
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());
                drs_result = results.primaryResults;
                //res.send(JSON.parse(results.primaryResults[0].toString()));
            }
        });  
        
        ksql = `
        let tmpDt = 
        (
            pcba_aoi
            | where plant == '@PLAT' and line =='@LINE' and machineName == @MACHINENAME and evt_dt >= @TIME_FROM and evt_dt <= @TIME_TO 
            | mv-expand locations
            | project site,plant,line,evt_dt,machineName,program,usn,model,numberOfComponentTested,result,locations_result = tostring(locations.result),evt_tp,evt_ns,evt_pubBy,evt_pid
        );
        tmpDt 
        | summarize cnt = count() by locations_result
        `;
        ksql = ksql.replace(/@PLAT/gi, p_plant);
        ksql = ksql.replace(/@LINE/gi, p_line);
        ksql = ksql.replace(/@MACHINENAME/gi, p_machineNames );
        ksql = ksql.replace(/@TIME_FROM/gi, p_timestampFrom );
        ksql = ksql.replace(/@TIME_TO/gi, p_timestampTo);
        

        console.log('要執行的KSQL語句2:',ksql);
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());
                drs_locations_result = results.primaryResults;
                //res.send(JSON.parse(results.primaryResults[0].toString()));
            }
        });  

        console.log(drs_result);
        console.log(drs_locations_result);
        let esResult = '';
                esResult = '{';
                esResult += '"took":999999,';
                esResult += '"hits":{"total":999999,"hits":[]},';
                esResult += '"aggregations":{';
                esResult += '"terms_based":{';
                esResult += '"buckets":[';
        res.send('ok');
    } catch (e) {
        console.log(e);
        res.send(e);
    }
    
});

//by Alex Lo use in getSpeed
//0813
function makeBucket(fd,timeGap){
    fd["data"].map(i=>{
        var time = i["evt_dt"];
        time = new Date(time);
        var timeDiff = time.getMinutes() % timeGap;
        time.setSeconds(0);
        time.setMilliseconds(0);
        if(timeDiff % timeGap != 0)
            time.setMinutes(time.getMinutes() - timeDiff+timeGap );
        i["evt_dt"] = time.getTime();
    });
    let bucket = [];
    let time = [];
    var pointer = -1;
    fd["data"].map(i=>{
         pointer++;
         time[pointer] = i["evt_dt"];
     });
    time = [...new Set(time)]; 
    time.sort(function(a,b){return a-b});  
    var tempmin = time[time.length-1];
    tempmin = new Date(tempmin);
    if(tempmin.getMinutes()%timeGap != 0)
        time = time.pop();
    //console.log(time);
    time.map(i=>{
      var tt = new Date(i);
      var hr;var min;
      if(tt.getHours()<10) hr = "0" + tt.getHours();
      else hr = tt.getHours();
      if(tt.getMinutes()<10) min = "0" + tt.getMinutes();
      else min = tt.getMinutes();
      var dcount = 0;
      var avalue = 0; 
      var svalue = 0;
      fd["data"].map(j=>{
        if(j["evt_dt"] == i)
        {
           dcount++;
           avalue = avalue + j["ChainSpeedActual"];
           svalue = svalue + j["ChainSpeedSetting"];
        }
      });
      bucket.push({
        "key_as_string":hr + ":" + min,
        "key":i,
        "doc_count":dcount,
        "actual":{"value" :avalue/dcount},
        "setting":{"value" :svalue/dcount}
      });
    })

    let final = {
        "took": 4,
        "timed_out": false,
        "_shards": {
            "total": 40,
            "successful": 40,
            "skipped": 0,
            "failed": 0
        },
        "hits": {
            "total": 579,
            "max_score": 0.0,
            "hits": []
        },
        "aggregations": {
            "terms_based": {
                "buckets":  bucket
            }
        }
    }


      return final;
  };

// 鏈速實時監控 kvm_20*/REFLOW/_search 
// getSpeed function
// by Alex Lo
app.post("/PCBA/kvm_20*_REFLOW_search/getSpeed", async function (req, res) { 
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        
        let Plant = req.body.plant;
        let line = req.body.line;
        let from = req.body.from;
        let to = req.body.to;
        let Machinename = req.body.machineName;
        let timeGap = req.body.timeGap;
        /*
        let Site = req.body.Site;
        let Plant = req.body.Plant;
        let Building = req.body.Building;
        let line = req.body.line;
        let Machinename = req.body.Machinename;
        let MachineID = req.body.MachineID;
        let evt_dt = req.body.evt_dt;
        */
        let machineString = Machinename.join();
        let ksql = `
        kvm_reflow
        | where plant == '${Plant}' and line =='${line}' and machineName in ('${machineString}') and evt_dt >= ${from} and evt_dt<= ${to}
        | project evt_dt, ChainSpeedSetting, ChainSpeedActual
        `;
        

        //指定data base
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());
                m = JSON.parse(results.primaryResults[0])
                res.send(JSON.stringify(makeBucket(m,timeGap)));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

//by Alex Lo use in getWINDSPEED
function makeWINDbucket(fd){
    var count = 0;
    let bucket = [];
    if(fd["data"].length > 0)
    {
        fd["data"][0]["evt_dt"].map(i=>{
        var tt = new Date(i);
        var hr;var min;var mon; var dat;
        if(tt.getHours()<10) hr = "0" + tt.getHours();
        else hr = tt.getHours();
        if(tt.getMinutes()<10) min = "0" + tt.getMinutes();
        else min = tt.getMinutes();
        if(tt.getMonth() + 1 <10) mon = "0" + (tt.getMonth()+1);
        else mon = (tt.getMonth()+1);
        if(tt.getDate()<10) dat = "0" + tt.getDate();
        else dat = tt.getDate();
        //console.log(tt)
        //console.log(mon+"/"+dat+" "+hr + ":" + min)
        bucket.push({
            "key_as_string":(mon+"/"+dat+" "+hr + ":" + min),
            "key":i,
            "wind2":{"value" :fd["data"][0]["wind2"][count]},
            "wind1":{"value" :fd["data"][0]["wind1"][count]}
            });
        count++;
        })
    }
    Presult = {
      "took": 4,
      "timed_out": false,
      "_shards": {
          "total": 40,
          "successful": 40,
          "skipped": 0,
          "failed": 0
      },
      "hits": {
          "total": 579,
          "max_score": 0.0,
          "hits": []
      },
      "aggregations": {
          "terms_based": 
          {"buckets": bucket
          }
      }
    };
    return Presult;
  }

//Alex Lo 0813 getWindSpeed
app.post("/PCBA/WINDSPEED/getWindSpeed", async function (req, res) { 
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        
        let Plant = req.body.plant;
        let line = req.body.line;
        let from = req.body.from;
        let to = req.body.to;
        let Machinename = req.body.machineName;
        let timeGap = req.body.timeGap;
        let machineString = Machinename.join();
        var time = from;
        time = new Date(from);
        timeDiff = time.getMinutes() % timeGap;
        time.setSeconds(0);
        time.setMilliseconds(0);
        if(timeDiff % timeGap != 0)
            time.setMinutes(time.getMinutes() - timeDiff+timeGap);
        from = time.getTime();


        let ksql = `
        pcba_reflow_windspeed
        | where Plant == '${Plant}' and line == '${line}' and Machinename == '${machineString}'  and evt_dt >= ${from} and evt_dt < ${to}
        | make-series wind1 = avg(ReflowWindSpeed1),wind2 = avg(ReflowWindSpeed2) on evt_dt from  ${from} to ${to} step (1000 * 60 * ${timeGap}) by Machinename
        `;
        //ksql = `
        //pcba_reflow_windspeed
        //| where Plant == 'F232' and line == 'HSB' and Machinename == 'REFLOW'  and evt_dt >= 1597190400000 and evt_dt < 1597274100000
        //| make-series wind1 = avg(ReflowWindSpeed1),wind2 = avg(ReflowWindSpeed2) on evt_dt from  1597190400000 to 1597274100000 step (1000 * 60 * 5) by Machinename
        //`;

        //指定data base
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());
                m = JSON.parse(results.primaryResults[0])
                //res.send(JSON.stringify(m))
                res.send(JSON.stringify(makeWINDbucket(m)));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});

//by Alex Lo 0814 use for getPSA
//psa_o2
//psa_mpa
function makePSADbucket(fd,PSA){
    var count = 0;
    let bucket = [];
    if(fd["data"].length > 0)
    {
        fd["data"][0]["evt_dt"].map(i=>{
        var tt = new Date(i);
        var hr;var min;
        if(tt.getHours()<10) hr = "0" + tt.getHours();
        else hr = tt.getHours();
        if(tt.getMinutes()<10) min = "0" + tt.getMinutes();
        else min = tt.getMinutes();
        if (PSA == "psa_o2"){
            bucket.push({
                "key_as_string":(hr + ":" + min),
                "key":i,
                "psa_o2":{"value" :fd["data"][0][PSA][count]}
                });
        } else{
            bucket.push({
                "key_as_string":(hr + ":" + min),
                "key":i,
                "psa_mpa":{"value" :fd["data"][0][PSA][count]}
                });

        }
        count++;
        })
    };
    Presult = {
      "took": 4,
      "timed_out": false,
      "_shards": {
          "total": 40,
          "successful": 40,
          "skipped": 0,
          "failed": 0
      },
      "hits": {
          "total": 579,
          "max_score": 0.0,
          "hits": []
      },
      "aggregations": {
          "terms_based": 
          {"buckets": bucket
          }
      }
    };
    return Presult;
  }
  


//Alex Lo 0814 getPSAOxygen
app.post("/PCBA/iotgateway/getPSAOxygen", async function (req, res) { 
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        
        let Plant = req.body.plant;
        let line = req.body.line;
        let from = req.body.from;
        let to = req.body.to;
        let timeGap = req.body.timeGap;
        var time = from;
        time = new Date(from);
        timeDiff = time.getMinutes() % timeGap;
        time.setSeconds(0);
        time.setMilliseconds(0);
        if(timeDiff % timeGap != 0)
            time.setMinutes(time.getMinutes() - timeDiff+timeGap);
        from = time.getTime();


        let ksql = `
        iotgateway_psa_o2
        | where Plant == '${Plant}' and Line == '${line}' and evt_dt >= ${from} and evt_dt < ${to}
        | make-series psa_o2 = avg(PSA_O2) on evt_dt from  ${from} to ${to} step (1000 * 60 * ${timeGap})
        `;
        //ksql = `
        //pcba_reflow_windspeed
        //| where Plant == 'F232' and line == 'HSB' and Machinename == 'REFLOW'  and evt_dt >= 1597190400000 and evt_dt < 1597274100000
        //| make-series wind1 = avg(ReflowWindSpeed1),wind2 = avg(ReflowWindSpeed2) on evt_dt from  1597190400000 to 1597274100000 step (1000 * 60 * 5) by Machinename
        //`;

        //指定data base
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());
                m = JSON.parse(results.primaryResults[0])
                //res.send(JSON.stringify(m))
                res.send(JSON.stringify(makePSADbucket(m,"psa_o2")));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});


//Alex Lo 0814 getPSAMPa
app.post("/PCBA/iotgateway/getPSAMPa", async function (req, res) { 
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        
        let Plant = req.body.plant;
        let line = req.body.line;
        let from = req.body.from;
        let to = req.body.to;
        let timeGap = req.body.timeGap;
        var time = from;
        time = new Date(from);
        timeDiff = time.getMinutes() % timeGap;
        time.setSeconds(0);
        time.setMilliseconds(0);
        if(timeDiff % timeGap != 0)
            time.setMinutes(time.getMinutes() - timeDiff+timeGap);
        from = time.getTime();


        let ksql = `
        iotgateway_psa_mpa
        | where Plant == '${Plant}' and Line == '${line}' and evt_dt >= ${from} and evt_dt < ${to}
        | make-series PSA_MPa = avg(PSA_MPa) on evt_dt from  ${from} to ${to} step (1000 * 60 * ${timeGap})
        `;
        //ksql = `
        //pcba_reflow_windspeed
        //| where Plant == 'F232' and line == 'HSB' and Machinename == 'REFLOW'  and evt_dt >= 1597190400000 and evt_dt < 1597274100000
        //| make-series wind1 = avg(ReflowWindSpeed1),wind2 = avg(ReflowWindSpeed2) on evt_dt from  1597190400000 to 1597274100000 step (1000 * 60 * 5) by Machinename
        //`;

        //指定data base
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());
                m = JSON.parse(results.primaryResults[0])
                //res.send(JSON.stringify(m))
                res.send(JSON.stringify(makePSADbucket(m,"PSA_MPa")));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});



// function 0817 by Alex Lo use in getOutputByPeriodTypeG
function makePowerbucket(fd){
    var count = 0;
    let bucket = [];
    if(fd["data"].length > 0){
    fd["data"][0]['evt_dt'].map(i=>{
      bucket.push({
        "key":String(i),
        "from":i,
        "to":i+299999,
        "eco":{
          "doc_count": 0,
          "sum_power": {
            "value": 0.0
          },
          "sum_duration": {
            "value": 0.0
          }
        },
        "normal":{
          "doc_count": 0,
          "sum_power": {
            "value": 0.0
          },
          "sum_duration": {
            "value": 0.0
          }
        },
          "standbyl":{
          "doc_count": 0,
          "sum_power": {
            "value": 0.0
          },
          "sum_duration": {
            "value": 0.0
          }
        }
      })
    });
    bucket.map(i =>{
      //console.log(i)
      fd["data"].map(j=>{
        var count = -1
        if(j["mode"]== "Normal"){
          j["evt_dt"].map( s=>{
            count++;
            if(s == i["from"])
            {
              i["normal"]["sum_power"] ["value"]=  j["sum_power"][count];
              i["normal"]["sum_duration"] ["value"]=  j["sum_duration"][count];
            }
  
          })
        } 
        else if(j["mode"]== "ECO"){
          j["evt_dt"].map( s=>{
            count++;
            if(s == i["from"])
            {
              i["eco"]["sum_power"] ["value"]=  j["sum_power"][count];
              i["eco"]["sum_duration"] ["value"]=  j["sum_duration"][count];
            }
          })
        } 
        else {
          j["evt_dt"].map( s=>{
            count++;
            if(s == i["from"])
            {
              i["standby"]["sum_power"] ["value"]=  j["sum_power"][count];
              i["standby"]["sum_duration"] ["value"]=  j["sum_duration"][count];
            }
          })
        } 
      })
    })
}
  Presult = {
      "took": 9,
      "timed_out": false,
      "_shards": {
          "total": 71,
          "successful": 71,
          "skipped": 0,
          "failed": 0
      },
      "hits": {
          "total": 168,
          "max_score": 0.0,
          "hits": []
      },
      "aggregations": {
          "model": {
              "doc_count_error_upper_bound": 0,
              "sum_other_doc_count": 0,
              "buckets": [
                  {
                      "key": "QA660WLG",
                      "doc_count": 168,
                      "terms_based": {
                          "buckets":bucket
                      }
                  }
              ]
          }
      }
  };
    return Presult;
  
  }



//Alex Lo 0814 getOutputByPeriodTypeG
app.post("/PCBA/active_reflow/power", async function (req, res) { 
    try {
        const clusterName = process.env.AzureDataExploere_ClusterName
        const KustoClient = require("azure-kusto-data").Client;
        const KustoConnectionStringBuilder = require("azure-kusto-data").KustoConnectionStringBuilder;
        const kcsb = KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
            `https://${clusterName}.kusto.windows.net`,
            process.env.AzureDataExploere_AppId,
            process.env.AzureDataExploere_AppKey,
            process.env.AzureDataExploere_AuthorityId
        );
        const client = new KustoClient(kcsb);
        
        let Plant = req.body.plant;
        let line = req.body.line;
        let from = req.body.from;
        let to = req.body.to;
        let timeGap = req.body.timeGap;
        var time = from;
        time = new Date(from);
        timeDiff = time.getMinutes() % timeGap;
        time.setSeconds(0);
        time.setMilliseconds(0);
        if(timeDiff % timeGap != 0)
            time.setMinutes(time.getMinutes() - timeDiff+timeGap);
        from = time.getTime();
        let lineString = line.join();


        let ksql = `
        pcba_active_reflow_power
        | where plant == '${Plant}' and line == '${lineString}'  and evt_dt >= ${from} and evt_dt < ${to}
        | make-series sum_power = sum(powerDelta),sum_duration = sum(duration) on evt_dt from  ${from} to ${to} step (1000 * 60 * 5)  by mode
        `;
        // for test
        // ksql = `
        // pcba_active_reflow_power
        // | where plant == '${Plant}' and evt_dt >= ${from} and evt_dt < ${to}
        // | make-series sum_power = sum(powerDelta),sum_duration = sum(duration) on evt_dt from  ${from} to ${to} step (1000 * 60 * 5)  by mode
        // `;
        //指定data base
        client.execute(process.env.KUSTODBNAME, ksql, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log(results.primaryResults[0].toString());
                m = JSON.parse(results.primaryResults[0])
                //res.send(JSON.stringify(m))
                res.send(JSON.stringify(makePowerbucket(m)));
            }
        });
    } catch (e) {
        console.log(e);
        res.send(e);
    }
});