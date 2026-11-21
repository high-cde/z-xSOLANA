import json,sys
c=json.load(open(sys.argv[1]))
c["schema"]="zdos-fondo-merito/2"
c["updatedAt"]="2026-11-21 20:30 Europe/Rome"
c["status"]="live"
c["emissionsLive"]=True
c["emissionsApproval"]="t399u 'Ok Avvio premi merito' (21/11/2026 19:56 Roma); moltiplicatori ruolo/holder t400u"
c["emissionsNote"]="Premi per contributi reali e verificabili, con tetto. Non è un rendimento e non è un investimento: nessun punto solo per detenere VELVET. Kill switch: emissionsLive=false oppure il file /etc/zdos-fondo-merito/STOP (bash /opt/zcomm/kill-switch.sh)."
c["wallet"]["signingEnabled"]=True
c["wallet"]["keyFile"]="/etc/zdos-agi-wallets/fondo-merito.json"
c["wallet"]["payFeesFrom"]="fondo merito (mai il wallet agente o altri)"
c["calendar"]["startAt"]="2026-11-21T19:56:00+01:00"
c["payout"]={"frequency":"settimanale","weekBoundary":"lunedì 00:00 Europe/Rome","runAt":"lunedì 00:10 Europe/Rome (systemd zcomm-payout.timer)",
 "scheduleText":"Ogni lunedì alle 00:10 (ora di Roma) si chiude la settimana precedente: dry-run, poi invio dal fondo.",
 "firstWeekProRata":True,"dryRunBeforeSend":True,"requireExistingTokenAccount":True,"solReserveLamports":900000,
 "noAutoResend":"Un invio interrotto passa in to_verify e non viene mai reinviato in automatico.",
 "publicRegister":"https://velvet.x-zdos.it/merito/#registro"}
c["exclusions"]={"note":"Il fondo non paga chi l'ha fondato né le AI ufficiali.",
 "ovids":["OV-0001-VELVET","OV-9GG7-VELVET"],
 "wallets":["5qke6mW7k3uEw4Bk67xSyGAk5zDgsLnpLK8P8J3V7dww","GEntwhyRQASi5n9uWSqYhMRtePGoogDpsbuoZBwCECDd","8gRVYw9oqgjfi2UpPfpgfJntPomrKroX42HKtrTrGYL6","HGkVsYyXpbrxqrhnbKeSe5epERLwWnA4oL4q6Z3joLt4","6qSyMUB1g7eXoiFSELt2Vf4B4Lv3YEUkWFxAQkfNyobU"]}
c["eligibility"]=["profilo Radar esistente con ID fisso OV-XXXX-VELVET","verificato","wallet collegato al Radar con firma Phantom","punti reali nella settimana","il wallet ha già un conto VELVET"]
c["merit"]={"points":{"invite_accepted":4,"invitee_verified":8,"profile_verified":5,"work_certified":20,"quest_done":3,"stage_rsvp":2},
 "pointsNote":"Invito accolto 4; quando l'invitato si verifica +8; propria verifica 5 (una volta); opera zNFT certificata 20; quest ZQuest fatta 3 (max 5 a settimana); RSVP stanza/evento 2.",
 "questWeeklyMax":5,"activeWindowDays":28,
 "dominantMultiplier":1.5,"dominantNote":"Mistress/Master verificati: x1,5 sui punti attività (t400u).",
 "holderTiers":[{"minVelvet":10000,"bonus":0.10},{"minVelvet":100000,"bonus":0.20}],"holderBonusMax":0.20,
 "holderNote":"Bonus a scaglioni con tetto (+10% da 10.000, +20% da 100.000 VELVET), solo su wallet collegato con firma e solo se ci sono punti attività. Mai proporzionale al saldo: detenere da solo non dà punti.",
 "antiSybil":["un ID Radar unico per persona, un wallet per ID (indice univoco)","inviti con limite per ruolo (Mistress 10, Fedele/Slave 5, Curioso 3)","punti invito pieni solo quando l'invitato si verifica","profilo cancellato = punti revocati (anche per chi l'ha invitato)","quest con tetto settimanale","tetto 5% del pool settimanale a profilo"]}
c["zcomm"]={"bus":"POST http://127.0.0.1:4192/zcomm/api/events (HMAC-SHA256, chiave /etc/zcomm/hmac.key)","register":"https://velvet.x-zdos.it/zcomm/api/events"}
json.dump(c,open(sys.argv[2],"w"),ensure_ascii=False,indent=2)
