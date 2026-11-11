# Génère plan.json — base du programme Ironmax jusqu'au 27 juin 2027.
# Vélo en % FTP (FTP de référence 255 W pour les semaines 7-11 reprises du dashboard), course en % VMA,
# natation au ressenti (4 séances en rotation). Lancer : python3 tools/gen_plan.py
import json,datetime as dt
F=255
pw=lambda w: round(w/F,3)
TPL={
"Base 1":[("nat","nat","nat","Natation",0,"matin"),("ss","ss","velo","Sweet spot",0,"soir"),("mA","muscuA","muscu","Muscu A",1,"matin"),("tempo","tempo","velo","Z2 + tempo",1,"soir"),("seuil","seuil","course","Seuil course",2,"soir"),("mB","muscuB","muscu","Muscu B",3,"matin"),("ef","ef","velo","Endurance de force",3,"soir"),("long","long","velo","Sortie longue vélo",5,"matin"),("lrun","longrun","course","Sortie longue course",6,"matin")],
"Base 2":[("nat","nat","nat","Natation",0,"matin"),("thr","thr","velo","Seuil vélo",0,"soir"),("mA","muscuA","muscu","Muscu A",1,"matin"),("tempo","tempo","velo","Z2 + tempo",1,"soir"),("seuil","seuil","course","Seuil course",2,"soir"),("mB","muscuB","muscu","Muscu B",3,"matin"),("ef","ef","velo","Endurance de force",3,"soir"),("long","long","velo","Sortie longue vélo",5,"matin"),("lrun","longrun","course","Sortie longue course",6,"matin")],
"Build":[("nat","nat","nat","Natation",0,"matin"),("ss","ss","velo","Sweet spot",0,"soir"),("mA","muscuA","muscu","Muscu A (allégée)",1,"matin"),("im","im","velo","Allure Ironman",1,"soir"),("seuil","seuil","course","Seuil course",2,"soir"),("mB","muscuB","muscu","Muscu B (allégée)",3,"matin"),("nat2","nat","nat","Natation 2",3,"midi"),("mp","marathon","course","Allure marathon",4,"soir"),("long","brick","velo","Sortie longue + enchaînement",5,"matin"),("lrun","longrun","course","Sortie longue course",6,"matin")],
"Spécifique":[("nat","nat","nat","Natation",0,"matin"),("ss","ss","velo","Sweet spot (rappel)",0,"soir"),("mA","muscuA","muscu","Muscu A (entretien)",1,"matin"),("im","im","velo","Allure Ironman",1,"soir"),("seuil","seuil","course","Seuil course",2,"soir"),("mB","muscuB","muscu","Muscu B (entretien)",3,"matin"),("ow","ow","nat","Eau libre / combinaison",3,"midi"),("z2run","z2run","course","Footing Z2",4,"soir"),("long","sim","velo","Simulation de course",5,"matin"),("lrun","longrun","course","Sortie longue course",6,"matin")],
"Affûtage":[("nat","nat","nat","Natation",0,"matin"),("mA","muscuA","muscu","Muscu légère",1,"matin"),("im","im","velo","Rappels allure IM",1,"soir"),("mp","marathon","course","Rappels allure marathon",2,"soir"),("ow","ow","nat","Eau libre",3,"midi"),("long","long","velo","Sortie vélo",5,"matin"),("lrun","longrun","course","Footing",6,"matin")],
}
def S(id,min,l=None,**p): return dict(id=id,min=min,l=l,p=p)
VO2=lambda sets:{"cond":"ftpTestBelow","k":"vo2","l":"VO2max (FTP < 265 W au test)","p":{"sets":sets,"w":1.12,"rec":"4'"}}
NAT=lambda var,m,light=0: S("nat",{1:40,2:50,3:50,4:45}[var] if not light else 35,None,var=var,m=m,light=light)
W={}
# --- Base 1 : reprise du programme validé (dashboard Polar Track) ---
W[7]=[NAT(1,1500,1),S("tempo",60,"Z2 facile",w=pw(165)),S("seuil",35,"Test VMA 6'",test="VMA"),S("ef",60,None,sets="3×6'",w=pw(200),rec="4'"),S("long",195,None,z2=pw(170),blocks="1×40'",w=pw(230)),S("lrun",80,None,v=.66),S("mA",50,"Muscu A légère",light=1)]
W[8]=[NAT(2,2400),S("ss",80,None,sets="3×18'",w=pw(232),rec="5'"),S("mA",60),S("tempo",75,None,tempo="30'",w=pw(210)),S("seuil",60,None,sets="4×8'",v=.80,rec="2'"),S("mB",60),S("ef",70,None,sets="3×12'",w=pw(205),rec="4'",rpm="66–68"),S("long",200,None,z2=pw(170),blocks="2×25'",w=pw(228)),S("lrun",80,None,v=.66)]
W[9]=[NAT(3,2500),S("ss",85,None,sets="4×15'",w=pw(233),rec="5'"),S("mA",60),S("tempo",75,None,tempo="30'",w=pw(212)),S("seuil",60,None,sets="3×12'",v=.81,rec="2'30"),S("mB",60),S("ef",75,None,sets="3×15'",w=pw(207),rec="4'",rpm="66–68"),S("long",210,None,z2=pw(172),blocks="2×30'",w=pw(230)),S("lrun",90,None,v=.66)]
W[10]=[NAT(4,2800),S("ss",90,None,sets="3×20'",w=pw(235),rec="5'"),S("mA",60),S("tempo",80,None,tempo="35'",w=pw(212)),S("seuil",60,None,sets="2×18'",v=.82,rec="3'"),S("mB",60),S("ef",75,None,sets="2×25'",w=pw(208),rec="5'",rpm="66–68"),S("long",225,None,z2=pw(172),blocks="25' puis 60' en fin de sortie",w=pw(230),w2=pw(207)),S("lrun",95,None,v=.66,blk="15' tempo en fin de sortie")]
W[11]=[NAT(1,1800,1),S("ss",60,None,sets="2×15'",w=pw(232),rec="5'"),S("mA",45,"Muscu A légère",light=1),S("tempo",60,"Z2 facile",w=pw(165)),S("seuil",45,None,sets="2×8'",v=.80,rec="2'"),S("ef",50,None,sets="2×12'",w=pw(205),rec="4'"),S("long",70,"Test FTP 20' (sam. 12 déc.)",test="FTP"),S("lrun",60,"Footing 1h",v=.64)]
# --- Base 2 : monter la FTP (seuil varié), tempo et endurance de force en progression ---
B2=[ # thr(sets,w,rec,vo2) tempo ef(sets,w) long(min,blocks,w) seuil(sets,v,rec) lrun(min,blk) nat
 dict(thr=("2×15'",.95,"5'","4×4'"),tempo="40'",ef=("3×15'",.81),long=(210,"2×30'",.82),seuil=("2×15'",.84,"3'"),lrun=(90,None),nat=(1,2600)),
 dict(thr=("3×12'",.98,"4'","5×4'"),tempo="45'",ef=("3×18'",.81),long=(225,"2×35'",.82),seuil=("3×10'",.87,"2'30"),lrun=(95,None),nat=(2,2800)),
 dict(thr=("2×20'",.95,"5'","5×4'"),tempo="2×25'",ef=("2×25'",.82),long=(240,"3×30'",.82),seuil=("2×18'",.84,"3'"),lrun=(100,"15' tempo en fin de sortie"),nat=(3,3000)),
 dict(thr=("3×10'",1.02,"5'","6×4'"),tempo="50'",ef=("3×20'",.82),long=(240,"2×45'",.80),seuil=("4×8'",.88,"2'"),lrun=(100,None),nat=(4,2600)),
 dict(thr=("2×20'",.97,"5'","6×4'"),tempo="2×30'",ef=("2×30'",.83),long=(255,"3×30'",.84),seuil=("3×12'",.86,"2'30"),lrun=(105,"20' tempo en fin de sortie"),nat=(2,3000)),
 dict(thr=("3×15'",.97,"5'","5×5'"),tempo="55'",ef=("3×20'",.83),long=(270,"2×50'",.80),seuil=("2×20'",.84,"3'"),lrun=(105,None),nat=(3,3200)),
 dict(thr=("2×25'",.95,"5'","5×5'"),tempo="60'",ef=("2×30'",.84),long=(270,"90' continu",.80),seuil=("3×12'",.87,"2'30"),lrun=(110,"20' tempo en fin de sortie"),nat=(1,2800)),
]
def base2(j,dl,n):
    if dl:
        r=[NAT(1,2000,1),S("thr",60,None,sets="2×10'",w=.95,rec="5'"),S("mA",45,"Muscu A légère",light=1),S("tempo",60,"Z2 facile",w=.65),S("seuil",45,None,sets="2×8'",v=.84,rec="2'"),S("mB",45,"Muscu B légère",light=1),S("long",150,None,z2=.68),S("lrun",60,None,v=.65)]
        if n==21: r=[x for x in r if x["id"]!="thr"]+[S("thr",60,"Retest FTP 20'",test="FTP")]; r=[x if x["id"]!="seuil" else S("seuil",35,"Retest VMA 6'",test="VMA") for x in r]
        return r
    c=B2[j];t=c["thr"]
    return [NAT(*c["nat"]),S("thr",75 if t[1]<1 else 70,None,sets=t[0],w=t[1],rec=t[2],alt=VO2(t[3])),S("mA",60),S("tempo",80 if "×" not in c["tempo"] else 85,None,tempo=c["tempo"],w=.82),S("seuil",60,None,sets=c["seuil"][0],v=c["seuil"][1],rec=c["seuil"][2]),S("mB",60),S("ef",75,None,sets=c["ef"][0],w=c["ef"][1],rec="4'",rpm="65–70"),S("long",c["long"][0],None,z2=.70,blocks=c["long"][1],w=c["long"][2]),S("lrun",c["lrun"][0],None,v=.66,blk=c["lrun"][1])]
# --- Build : sweet spot en 2 vagues, allure IM qui s'allonge, enchaînements ---
BU=[ # ss(sets,w,ou) im(sets,w,min) long(min,blocks,brick) seuil(sets,v) mp(sets,min) lrun(min,blk) nat,nat2
 dict(ss=("3×20'",.90,None),im=("2×30'",.78,105),long=(270,"2×45'","20'"),seuil=("3×10'",.86),mp=("3×10'",50),lrun=(105,None),nat=(2,2800),nat2=(3,3000)),
 dict(ss=("3×25'",.90,None),im=("2×35'",.78,110),long=(285,"2×50'","25'"),seuil=("4×8'",.88),mp=("3×12'",55),lrun=(110,None),nat=(4,2800),nat2=(3,3000)),
 dict(ss=("2×40'",.88,None),im=("2×40'",.78,120),long=(300,"2×60'","30'"),seuil=("3×12'",.86),mp=("3×15'",60),lrun=(120,"3×10' allure marathon"),nat=(1,2800),nat2=(3,3200)),
 dict(ss=("4×15' en sur-sous (3' / 2')",None,(.95,.85)),im=("2×45'",.80,120),long=(300,"2×60'","30'"),seuil=("5×6'",.89),mp=("3×15'",60),lrun=(120,None),nat=(2,3000),nat2=(3,3200)),
 dict(ss=("3×20'",.93,None),im=("3×30'",.80,125),long=(315,"2×70'","35'"),seuil=("3×12'",.87),mp=("2×25'",65),lrun=(125,"3×15' allure marathon"),nat=(4,3000),nat2=(3,3400)),
 dict(ss=("2×30'",.93,None),im=("2×50'",.80,130),long=(330,"2×75'","40'"),seuil=("3×15'",.86),mp=("2×30'",70),lrun=(135,"2×20' allure marathon"),nat=(2,3000),nat2=(3,3500)),
 dict(ss=("3×15'",.93,None),im=("2×40'",.80,115),long=(300,"2×60'","30'"),seuil=("4×8'",.88),mp=("3×15'",60),lrun=(120,None),nat=(1,2800),nat2=(3,3200)),
]
def build(j,dl,n):
    if dl: return [NAT(1,2200,1),S("ss",60,None,sets="2×15'",w=.88,rec="5'"),S("mA",40,"Muscu A légère",light=1),S("im",60,None,sets="2×15'",w=.78,rec="5'"),S("seuil",45,None,sets="2×8'",v=.86,rec="2'"),S("long",180,None,z2=.70),S("lrun",70,None,v=.66)]
    c=BU[j];ss=c["ss"]
    ssd=S("ss",90,None,sets=ss[0],w=ss[1],rec="5'") if not ss[2] else S("ss",90,None,sets=ss[0],ou=list(ss[2]),rec="5'")
    return [NAT(*c["nat"]),ssd,S("mA",45),S("im",c["im"][2],None,sets=c["im"][0],w=c["im"][1],rec="5'"),S("seuil",60,None,sets=c["seuil"][0],v=c["seuil"][1],rec="2'"),S("mB",45),NAT(*c["nat2"]) | {"id":"nat2"},S("mp",c["mp"][1],None,sets=c["mp"][0],v=.66,rec="3'"),S("long",c["long"][0],None,z2=.72,blocks=c["long"][1],w=.78,brick=c["long"][2]),S("lrun",c["lrun"][0],None,v=.66,blk=c["lrun"][1])]
# --- Spécifique : simulations, sweet spot en rappel décroissant ---
SP=[ # ss(sets) im(sets,w,min) sim(min,blocks,brick) seuil lrun(min,blk) ow
 dict(ss="3×15'",im=("2×45'",.80,120),sim=(360,"4h30 allure IM","45'"),seuil="2×12'",lrun=(150,"60' allure IM"),ow=3000),
 None, # EVG
 dict(ss="2×15'",im=("2×40'",.80,110),sim=(390,"5h allure IM","60'"),seuil="3×8'",lrun=(160,"75' allure IM"),ow=3500),
 dict(ss="2×15'",im=("3×25'",.80,110),sim=(375,"4h45 allure IM","50'"),seuil="2×12'",lrun=(150,"60' allure IM"),ow=3800),
 dict(ss="2×12'",im=("2×30'",.80,95),sim=(330,"4h allure IM","40'"),seuil="2×10'",lrun=(135,"45' allure IM"),ow=3800),
 dict(ss="2×10'",im=("2×20'",.80,80),sim=(240,"3h allure IM","30'"),seuil="2×8'",lrun=(110,"30' allure IM"),ow=3000),
]
def spec(j,dl,n):
    if dl: return [NAT(1,2200,1),S("ss",60,None,sets="2×12'",w=.88,rec="5'"),S("im",75,None,sets="2×20'",w=.78,rec="5'"),S("seuil",45,None,sets="2×8'",v=.86,rec="2'"),S("long",150,None,z2=.70),S("lrun",75,None,v=.66)]
    c=SP[j]
    return [NAT(4,3000),S("ss",70,None,sets=c["ss"],w=.91,rec="5'"),S("mA",45),S("im",c["im"][2],None,sets=c["im"][0],w=c["im"][1],rec="5'"),S("seuil",55,None,sets=c["seuil"],v=.86,rec="2'30"),S("mB",45),S("ow",60,None,m=c["ow"]),S("z2run",45,None,v=.66),S("long",c["sim"][0],"Simulation : vélo + course",z2=.72,blocks=c["sim"][1],w=.77,brick=c["sim"][2]),S("lrun",c["lrun"][0],None,v=.66,blk=c["lrun"][1])]
def taper(j,n):
    if n==39: return [NAT(1,1500,1),S("im",50,None,sets="3×5'",w=.80,rec="3'"),S("mp",30,None,sets="3×4'",v=.66,rec="2'"),S("ow",25,"Eau libre · reconnaissance",m=1000),S("long",45,"Vélo 45' + check matériel",z2=.65),S("lrun",0,"IRONMAN · dim. 27 juin",race=1)]
    return [NAT(4,2500),S("im",[80,60][j],None,sets=["3×10'","3×8'"][j],w=.80,rec="4'"),S("mA",[40,30][j],"Muscu légère",light=1),S("mp",[50,40][j],None,sets=["3×8'","2×8'"][j],v=.66,rec="2'"),S("ow",45,None,m=[2500,2000][j]),S("long",[180,120][j],None,z2=.70,blocks=["3×15'","2×15'"][j],w=.78),S("lrun",[75,60][j],None,v=.66)]
def phase(d):
    if d<=dt.date(2026,12,13): return "Base 1"
    if d<=dt.date(2027,2,21): return "Base 2"
    if d<=dt.date(2027,4,25): return "Build"
    if d<=dt.date(2027,6,6): return "Spécifique"
    return "Affûtage"
DL={7,11,15,19,21,25,29,32}
weeks=[];ctr={}
for i in range(33):
    n=7+i;st=dt.date(2026,11,9)+dt.timedelta(weeks=i);ph=phase(st);dl=n in DL
    if n in W: ss=W[n]
    else:
        j=ctr.get(ph,0)
        if ph=="Spécifique": ctr[ph]=j+1
        elif not dl: ctr[ph]=j+1
        ss={"Base 2":base2,"Build":build,"Spécifique":spec}.get(ph,lambda j,dl,n:taper(j,n))(j,dl,n) if ph!="Affûtage" else taper(j,n)
    note={7:"Décharge · test VMA",11:"Décharge · test FTP",12:"Si FTP < 265 W au test : VO2max le lundi",21:"Décharge · retests FTP + VMA",32:"Semaine allégée · EVG",39:"Semaine de course"}.get(n,"Décharge" if dl else "")
    test={11:"Test FTP 20'",21:"Retest FTP + VMA",39:"IRONMAN"}.get(n)
    tpl={t[0]:t for t in TPL[ph]};disc={"velo":0,"course":0,"nat":0,"muscu":0}
    for s in ss: disc[tpl[s["id"]][2]]+=s["min"]/60
    weeks.append({"n":n,"start":str(st),"phase":ph,"deload":dl,"note":note,"test":test,"h":round(sum(disc.values()),1),"disc":{k:round(v,1) for k,v in disc.items()},"s":ss})
blocks=[{"n":"Base 1","from":"2026-09-28","to":"2026-12-13","f":"FTP et endurance vélo · natation en entretien"},{"n":"Base 2","from":"2026-12-14","to":"2027-02-21","f":"Monter la FTP · volume sur les 3 sports"},{"n":"Build","from":"2027-02-22","to":"2027-04-25","f":"Allure IM · enchaînements · tenir 210 W"},{"n":"Spécifique","from":"2027-04-26","to":"2027-06-06","f":"Simulations · nutrition · eau libre"},{"n":"Affûtage","from":"2027-06-07","to":"2027-06-27","f":"Fraîcheur, rappels d'intensité"}]
for b in blocks: b["tpl"]=[{"id":t[0],"k":t[1],"d":t[2],"l":t[3],"day":t[4],"slot":t[5]} for t in TPL[b["n"]]]
plan={"version":3,"race":"2027-06-27","ftpTestDate":"2026-12-12","blocks":blocks,"weeks":weeks,
 "past":{"Base 1":{"from":"2026-09-28","plannedH":{"velo":32.0,"course":16.0,"nat":5.1,"muscu":10.9}}},
 "swim":{"1":["Technique","400 m souple · 8×50 m éducatifs · 6×100 m facile (4/10) r20\" · 200 m souple"],"2":["Fractionné modéré","400 m souple · 4×50 m · 5×300 m à 6/10 r20\" · 3×100 m vite · 200 m souple"],"3":["Endurance continue","400 m souple · bloc continu facile à 5/10 · 200 m souple"],"4":["Soutenu","400 m souple · 4×50 m · 8×100 m à 7–8/10 r15\" · 300 m pull-buoy · 200 m souple"]},
 "muscu":{"muscuA":["Développé couché","Tractions pronation","Rowing unilatéral haltère","Écarté poulie","Fentes bulgares","Leg curl","Superset biceps / triceps"],"muscuB":["Développé incliné","Tractions prise neutre","Face pull","Élévations latérales","Squat","Mollets","Superset curl marteau / dips"]},
 "rules":["Pas de séance qualité tôt le matin dans les 12 h après une séance du soir","Statut Nightly Recharge 1–2 au réveil → bloc intense supprimé","Sortie vallonnée : montées plafonnées à 225 W et 165 bpm","Natation au ressenti : 4/10 facile · 6/10 modéré · 7–8/10 soutenu"]}
json.dump(plan,open('plan.json','w'),ensure_ascii=False,separators=(",",":"))
for w in weeks: print(w["n"],w["phase"],w["h"],[ (s["id"],s["p"].get("sets") or s["p"].get("blocks") or s["p"].get("var")) for s in w["s"] if s["id"] in("ss","thr","long","seuil")])
