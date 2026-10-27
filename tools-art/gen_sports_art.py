# Generates assets/sports-dN-qM.svg (Brain Clash style). No answers, logos or likenesses.
import os
O,Y,C,N,W="#E8582A","#F2C230","#FFF6E8","#1F2C7A","#fff"
F="Anton,Impact,'Arial Narrow Bold',sans-serif"
def ball_basket(): return f'<circle r="46" fill="{O}" stroke="{N}" stroke-width="4"/><path d="M-46 0H46M0-46V46M-32-33c14 14 14 52 0 66M32-33c-14 14-14 52 0 66" stroke="{N}" stroke-width="4" fill="none"/>'
def ball_foot(): return f'<g transform="rotate(-30)"><ellipse rx="58" ry="34" fill="#8a4a24" stroke="{N}" stroke-width="4"/><path d="M-22 0H22M-14-6v12M-5-6v12M5-6v12M14-6v12" stroke="{W}" stroke-width="4"/><path d="M-44-14c4 8 4 20 0 28M44-14c-4 8-4 20 0 28" stroke="{W}" stroke-width="4" fill="none"/></g>'
def ball_base(): return f'<circle r="44" fill="{W}" stroke="{N}" stroke-width="4"/><path d="M-30-32c12 16 12 48 0 64M30-32c-12 16-12 48 0 64" stroke="{O}" stroke-width="4" fill="none" stroke-dasharray="6 5"/>'
def ball_soccer(): return f'<circle r="46" fill="{W}" stroke="{N}" stroke-width="4"/><path d="M0-16l15 11-6 18H-9l-6-18z" fill="{N}"/><path d="M0-16V-44M15-5l26-8M9 13l16 22M-9 13l-16 22M-15-5l-26-8" stroke="{N}" stroke-width="4"/>'
def ball_tennis(): return f'<circle r="40" fill="{Y}" stroke="{N}" stroke-width="4"/><path d="M-28-28c18 14 18 42 0 56M28-28c-18 14-18 42 0 56" stroke="{W}" stroke-width="5" fill="none"/>'
def racket(): return f'<g transform="rotate(35)"><ellipse cy="-30" rx="30" ry="40" fill="none" stroke="{N}" stroke-width="7"/><path d="M-20-56v52M-10-68v76M0-70v80M10-68v76M20-56v52M-28-44h56M-30-30h60M-28-16h56" stroke="{N}" stroke-width="1.5" opacity=".6"/><rect x="-6" y="10" width="12" height="50" rx="4" fill="{O}" stroke="{N}" stroke-width="3"/></g>'
def puck(): return f'<g transform="translate(-10 0)"><path d="M40-60L0 34h-44" stroke="{N}" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M-6 34h-38" stroke="{O}" stroke-width="10" stroke-linecap="round"/></g><ellipse cx="38" cy="44" rx="22" ry="8" fill="{N}"/><rect x="16" y="34" width="44" height="10" fill="{N}"/><ellipse cx="38" cy="34" rx="22" ry="8" fill="#3a4aa0"/>'
def golf(): return f'<path d="M-6 52V-50" stroke="{N}" stroke-width="5"/><path d="M-6-50l44 14-44 14z" fill="{O}"/><ellipse cx="-6" cy="54" rx="34" ry="8" fill="#5aa05a"/><circle cx="26" cy="44" r="10" fill="{W}" stroke="{N}" stroke-width="3"/>'
def bat_cricket(): return f'<g transform="rotate(-25)"><rect x="-12" y="-30" width="24" height="86" rx="8" fill="#e8c890" stroke="{N}" stroke-width="4"/><rect x="-4" y="-62" width="8" height="34" fill="{N}"/></g><circle cx="38" cy="36" r="14" fill="#c0392b" stroke="{N}" stroke-width="3"/><path d="M26 30c8 6 16 6 24 0" stroke="{W}" stroke-width="2" fill="none"/>'
def trophy(): return f'<path d="M-30-50h60v20c0 26-14 42-30 42s-30-16-30-42z" fill="{Y}" stroke="{N}" stroke-width="4"/><path d="M-30-40h-16c0 20 10 28 18 28M30-40h16c0 20-10 28-18 28" stroke="{N}" stroke-width="4" fill="none"/><rect x="-8" y="12" width="16" height="22" fill="{Y}" stroke="{N}" stroke-width="4"/><rect x="-28" y="34" width="56" height="16" rx="3" fill="{O}" stroke="{N}" stroke-width="4"/>'
def medal(): return f'<path d="M-26-60l18 44M26-60l-18 44" stroke="{O}" stroke-width="14"/><circle cy="14" r="34" fill="{Y}" stroke="{N}" stroke-width="4"/><path d="M0-4l6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z" fill="{O}"/>'
def torch(): return f'<path d="M-14-10h28l-8 70h-12z" fill="{Y}" stroke="{N}" stroke-width="4"/><path d="M0-14c-26-10-10-36 0-54 4 18 26 26 10 50z" fill="{O}" stroke="{N}" stroke-width="3"/><path d="M0-18c-8-8 0-18 2-26 4 10 10 16 2 26z" fill="{Y}"/>'
def stopwatch(): return f'<circle cy="8" r="46" fill="{W}" stroke="{N}" stroke-width="5"/><rect x="-8" y="-52" width="16" height="12" fill="{N}"/><path d="M0 8V-24M0 8l20 14" stroke="{O}" stroke-width="5" stroke-linecap="round"/><circle cy="8" r="5" fill="{N}"/>'
def mystery(icon):  # generic player silhouette with ? — no likeness
    return f'<circle cy="-42" r="20" fill="{N}"/><path d="M-36 60c0-46 12-70 36-70s36 24 36 70z" fill="{N}"/><text y="44" text-anchor="middle" font-family="{F}" font-size="56" fill="{Y}">?</text><g transform="translate(64 34) scale(.42)">{icon}</g>'
def crest(fill,stroke,icon):  # generic shield with ? — no team logos
    return f'<path d="M-46-58h92v40c0 44-26 66-46 76-20-10-46-32-46-76z" fill="{fill}" stroke="{stroke}" stroke-width="6"/><text y="24" text-anchor="middle" font-family="{F}" font-size="66" fill="{W}">?</text><g transform="translate(66 40) scale(.36)">{icon}</g>'
def helmet(): return f'<path d="M-50 20c0-50 30-72 64-72 34 0 48 30 48 58v14H8v20h-40c-12 0-18-10-18-20z" fill="{N}" stroke="{N}" stroke-width="4"/><path d="M40 20h22M30 20v24h34M48 20v24" stroke="{Y}" stroke-width="5" fill="none"/><circle cx="-6" cy="4" r="8" fill="{C}"/>'
def cap(): return f'<path d="M-48 14c0-40 20-58 48-58s48 18 48 58z" fill="{N}"/><path d="M40 14h46c0 10-10 14-24 14H-48z" fill="{N}"/><circle cy="-46" r="6" fill="{O}"/>'
def pins(): return ''.join(f'<g transform="translate({x} {y})"><path d="M0-36c8 0 8 14 4 20 10 12 10 34 4 50h-16c-6-16-6-38 4-50-4-6-4-20 4-20z" fill="{W}" stroke="{N}" stroke-width="3"/><path d="M-5-14h10M-6-10h12" stroke="{O}" stroke-width="3"/></g>' for x,y in [(-34,12),(34,12),(0,0)])
def dartboard(): return f'<circle r="50" fill="{N}"/>'+''.join(f'<path d="M0 0L{50*__import__("math").cos(a*0.314159):.1f} {50*__import__("math").sin(a*0.314159):.1f}A50 50 0 0 1 {50*__import__("math").cos((a+1)*0.314159):.1f} {50*__import__("math").sin((a+1)*0.314159):.1f}z" fill="{[C,N][a%2]}"/>' for a in range(20))+f'<circle r="34" fill="none" stroke="{O}" stroke-width="5"/><circle r="8" fill="{O}"/><circle r="3" fill="{N}"/><path d="M20-20l34-34" stroke="{Y}" stroke-width="4"/><path d="M50-56l10-4-4 10z" fill="{Y}"/>'
def checkered(): return f'<path d="M-40 60V-56" stroke="{N}" stroke-width="5"/>'+''.join(f'<rect x="{-40+i*16}" y="{-56+j*16}" width="16" height="16" fill="{[W,N][(i+j)%2]}"/>' for i in range(5) for j in range(4))
def car(): return f'<path d="M-64 20l10-20h40l14-16h30l10 16h20v20z" fill="{O}" stroke="{N}" stroke-width="4"/><circle cx="-40" cy="24" r="12" fill="{N}"/><circle cx="40" cy="24" r="12" fill="{N}"/><path d="M-8-12h20" stroke="{N}" stroke-width="4"/>'
def bike(): return f'<circle cx="-36" cy="20" r="28" fill="none" stroke="{N}" stroke-width="5"/><circle cx="36" cy="20" r="28" fill="none" stroke="{N}" stroke-width="5"/><path d="M-36 20l22-36h40L36 20M-14-16L4 20 26-16M-20-26h16M26-16l-6-14h12" stroke="{O}" stroke-width="5" fill="none" stroke-linejoin="round"/>'
def swim(): return f'<rect x="-80" y="-46" width="160" height="96" rx="6" fill="#5ab4e0" stroke="{N}" stroke-width="4"/>'+''.join(f'<path d="M-80 {y}H80" stroke="{W}" stroke-width="3" stroke-dasharray="8 6"/>' for y in (-14,18))+f'<circle cx="10" cy="2" r="8" fill="{O}"/><path d="M-6 6c-10 0-20-4-28 0M18 -2l22-10" stroke="{N}" stroke-width="4" stroke-linecap="round"/>'
def track(): return ''.join(f'<path d="M-90 {y}H90" stroke="{W}" stroke-width="3"/>' for y in (-30,0,30))+f'<rect x="-90" y="-46" width="180" height="92" fill="none"/><path d="M-6-34l14 10-8 22 14 16M8-24l18 4M-4-14l-16 8M0 -2l-14 22" stroke="{N}" stroke-width="6" stroke-linecap="round" fill="none"/><circle cx="10" cy="-40" r="7" fill="{N}"/>'
def hurdles(): return ''.join(f'<g transform="translate({x} 0)"><path d="M-14 40V0M14 40V0" stroke="{N}" stroke-width="4"/><rect x="-18" y="-6" width="36" height="10" fill="{O}" stroke="{N}" stroke-width="3"/></g>' for x in (-56,0,56))
def snowflake(): return f'<g stroke="{N}" stroke-width="6" stroke-linecap="round">'+''.join(f'<g transform="rotate({a})"><path d="M0 0V-50M0-32l-12-12M0-32l12-12"/></g>' for a in range(0,360,60))+'</g>'
def horse(): return f'<path d="M-50 30l8-36c4-16 20-22 36-20h30l16-20 6 6-6 20 14 14-6 8-18-8-10 6v30M-30 30l-4-26M24 30l4-24" stroke="{N}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M-42-4c-16 0-26 12-30 24" stroke="{N}" stroke-width="6" fill="none"/>'
def net(): return f'<path d="M-80 40H80" stroke="{N}" stroke-width="4"/><rect x="-6" y="-30" width="12" height="70" fill="{N}"/><path d="M-70-24H70V6H-70z" fill="none" stroke="{N}" stroke-width="3"/>'+''.join(f'<path d="M{x}-24V6" stroke="{N}" stroke-width="1"/>' for x in range(-60,70,12))
def volleyball(): return f'<circle r="44" fill="{W}" stroke="{N}" stroke-width="4"/><path d="M0 0C-10-20-6-36 8-44M0 0c22-4 36 4 42 16M0 0c-12 18-28 26-42 24" stroke="{O}" stroke-width="5" fill="none"/>'
def wrestlers(): return f'<circle cx="-30" cy="-30" r="14" fill="{N}"/><circle cx="30" cy="-30" r="14" fill="{O}"/><path d="M-56 50c0-40 10-66 30-66 14 0 20 10 26 22z" fill="{N}"/><path d="M56 50c0-40-10-66-30-66-14 0-20 10-26 22z" fill="{O}"/><ellipse cy="56" rx="80" ry="8" fill="{Y}"/>'
def goalposts(): return f'<path d="M0 60V10M-44 10H44M-44 10V-60M44 10V-60" stroke="{Y}" stroke-width="7" stroke-linecap="round" fill="none"/><g transform="translate(0 -28) scale(.45)">{ball_foot()}</g>'
def eightball(): return f'<circle r="40" fill="{N}"/><circle cx="-10" cy="-10" r="16" fill="{W}" opacity=".15"/><circle cx="60" cy="10" r="20" fill="{O}" stroke="{N}" stroke-width="3"/><circle cx="-60" cy="12" r="20" fill="{Y}" stroke="{N}" stroke-width="3"/>'
def jersey(c): return f'<path d="M-24-50h48l34 20-14 26-14-8v66h-60v-66l-14 8-14-26z" fill="{c}" stroke="{N}" stroke-width="4"/><text y="22" text-anchor="middle" font-family="{F}" font-size="42" fill="{W}">?</text>'
def stadium(): return f'<path d="M-80 40c0-50 36-70 80-70s80 20 80 70z" fill="{N}"/><ellipse cy="40" rx="70" ry="14" fill="#5aa05a"/><path d="M-70-6l-10-30M70-6l10-30" stroke="{Y}" stroke-width="5"/><circle cx="-80" cy="-40" r="7" fill="{Y}"/><circle cx="80" cy="-40" r="7" fill="{Y}"/>'
def wheelchair(): return f'<circle cx="-6" cy="22" r="34" fill="none" stroke="{N}" stroke-width="6"/><circle cx="-6" cy="-52" r="10" fill="{O}"/><path d="M-6-36v34h36l14 30M-6-20h28" stroke="{O}" stroke-width="8" stroke-linecap="round" fill="none"/>'
def handball(): return f'<circle r="34" fill="{Y}" stroke="{N}" stroke-width="4"/><path d="M-34 0h68M0-34c-14 20-14 48 0 68" stroke="{N}" stroke-width="3" fill="none"/><path d="M-60 60V-40h120v100" stroke="{O}" stroke-width="6" fill="none"/>'
def scrum(): return ''.join(f'<circle cx="{x}" cy="{y}" r="11" fill="{c}"/>' for x,y,c in [(-50,-10,N),(-26,-14,N),(-2,-10,N),(26,-10,O),(50,-14,O),(74,-10,O)])+f'<path d="M-70 20h160" stroke="{N}" stroke-width="4"/><text x="10" y="56" text-anchor="middle" font-family="{F}" font-size="34" fill="{N}">?</text>'
def calendar(): return f'<rect x="-46" y="-44" width="92" height="96" rx="8" fill="{W}" stroke="{N}" stroke-width="4"/><rect x="-46" y="-44" width="92" height="24" rx="8" fill="{O}"/><text y="30" text-anchor="middle" font-family="{F}" font-size="46" fill="{N}">?</text>'
def statcard(n,u): return f'<rect x="-82" y="-50" width="164" height="100" rx="12" fill="{N}"/><text y="18" text-anchor="middle" font-family="{F}" font-size="62" fill="{Y}">{n}</text><text y="42" text-anchor="middle" font-family="{F}" font-size="16" letter-spacing="2" fill="{C}">{u}</text>'
def ring(): return f'<rect x="-80" y="-48" width="160" height="96" rx="8" fill="#e8f2ff" stroke="{N}" stroke-width="4"/><path d="M-80 0H80" stroke="#c0392b" stroke-width="4"/><circle r="16" fill="none" stroke="#2a6fd6" stroke-width="4"/><path d="M-50-48v96M50-48v96" stroke="#2a6fd6" stroke-width="3"/>'
def clock24(): return f'<circle r="46" fill="{W}" stroke="{N}" stroke-width="5"/><path d="M0 0V-30M0 0l22 10" stroke="{O}" stroke-width="5" stroke-linecap="round"/><circle r="5" fill="{N}"/>'+''.join(f'<circle cx="{38*__import__("math").sin(a*0.5236):.1f}" cy="{-38*__import__("math").cos(a*0.5236):.1f}" r="3" fill="{N}"/>' for a in range(12))
def boxing(): return f'<path d="M-50-10c0-24 16-36 34-36s30 12 30 34c0 18-10 30-28 32v20h-34v-24c-2-8-2-16-2-26z" fill="#c0392b" stroke="{N}" stroke-width="4"/><path d="M50-10c0-24-16-36-34-36" stroke="{N}" stroke-width="0"/><g transform="translate(66 0) scale(-1 1)"><path d="M-50-10c0-24 16-36 34-36s30 12 30 34c0 18-10 30-28 32v20h-34v-24c-2-8-2-16-2-26z" fill="{N}" stroke="{N}" stroke-width="4"/></g>'
def bar(): return f'<path d="M-50 60V-40M50 60V-40" stroke="{N}" stroke-width="5"/><path d="M-56-30H56" stroke="{O}" stroke-width="5"/><path d="M-70 44h140" stroke="{N}" stroke-width="3"/>'
def pole(): return f'<path d="M-80 50L60-50" stroke="{N}" stroke-width="5" stroke-linecap="round"/><path d="M50 60V-46M90 60V-46" stroke="{N}" stroke-width="4"/><path d="M44-34h52" stroke="{O}" stroke-width="5"/>'
def sandpit(): return f'<rect x="-80" y="22" width="160" height="26" rx="6" fill="{Y}" stroke="{N}" stroke-width="3"/><path d="M-90 22h20" stroke="{W}" stroke-width="6"/><path d="M-50-30c30-30 70-20 90 40" stroke="{O}" stroke-width="4" stroke-dasharray="6 6" fill="none"/><circle cx="-52" cy="-40" r="8" fill="{N}"/>'
def ice(): return f'<rect x="-84" y="-44" width="168" height="88" rx="40" fill="#e8f2ff" stroke="{N}" stroke-width="4"/><path d="M0-44v88" stroke="#c0392b" stroke-width="4"/><circle r="16" fill="none" stroke="#2a6fd6" stroke-width="3"/><ellipse cx="34" cy="10" rx="10" ry="4" fill="{N}"/>'

LBL={}
def S(t,icon,lbl): return (t,icon,lbl)
Q={
'd1':[S('scene',helmet()+'','PRO FOOTBALL · FEB 2024'),S('sil',mystery(ball_basket()),'SILHOUETTE CLUE'),S('stat',statcard('762','CAREER HOME RUNS'),'MLB RECORD')],
'd2':[S('scene',trophy(),'WORLD CUP 2022'),S('logo',crest(N,'#8a96b8',ball_foot()),'LOGO CLUE · NFL'),S('stat',statcard('24','GRAND SLAM TITLES'),"MEN'S TENNIS")],
'd3':[S('scene',ice(),'NHL · EVEN STRENGTH'),S('sil',mystery(golf()),'SILHOUETTE CLUE'),S('scene',ball_basket(),'NBA · 1962')],
'd4':[S('scene',trophy(),'NBA CHAMPIONS'),S('logo',crest(N,W,ball_base()),'LOGO CLUE · MLB'),S('stat',statcard('7','SUPER BOWL WINS'),'QB RECORD')],
'd5':[S('stat',statcard('9.58','SECONDS · 100 M'),'WORLD RECORD'),S('sil',mystery(ball_soccer()),'SILHOUETTE CLUE'),S('stat',statcard('23','OLYMPIC GOLDS'),'SWIMMING RECORD')],
'd6':[S('scene',helmet(),'NFL SCORING'),S('logo',crest('#2e8b57',W,ball_basket()),'LOGO CLUE · NBA'),S('scene',snowflake(),'WINTER OLYMPICS · 1924')],
'd7':[S('scene',golf(),'GOLF'),S('sil',mystery(boxing()),'SILHOUETTE CLUE'),S('scene',ball_foot().replace('#8a4a24',W),'RUGBY WORLD CUP · 1987')],
'd8':[S('scene',ball_basket(),'NBA GAME CLOCK'),S('sil',mystery(puck()),'SILHOUETTE CLUE'),S('scene',racket(),'WIMBLEDON · 1877')],
'd9':[S('scene',ball_soccer(),'SOCCER'),S('logo',crest('#552583',Y,ball_basket()),'LOGO CLUE · NBA'),S('scene',medal(),'OLYMPICS · 1976')],
'd10':[S('scene',ball_tennis(),'TENNIS SCORING'),S('logo',crest('#af1e2d','#192168',puck()),'LOGO CLUE · NHL'),S('scene',bat_cricket(),'CRICKET WORLD CUP · 1975')],
'd11':[S('scene',ball_base(),'BASEBALL'),S('sil',mystery(ball_soccer()),'SILHOUETTE CLUE'),S('scene',torch(),'SUMMER OLYMPICS · 1964')],
'd12':[S('scene',net(),'WHICH SPORT?'),S('scene',golf(),'GOLF MAJOR'),S('scene',bike(),'TOUR DE FRANCE · 1903')],
'd13':[S('scene',racket(),'WIMBLEDON'),S('scene',ice(),'1980 OLYMPICS'),S('scene',horse(),'TRIPLE CROWN · 1973')],
'd14':[S('scene',torch(),'OLYMPIC FLAG'),S('logo',crest('#111',Y,helmet()),'LOGO CLUE · NFL'),S('scene',sandpit(),'LONG JUMP · 1968')],
'd15':[S('scene',ball_basket(),'NBA SCORING'),S('sil',mystery(ball_basket()),'SILHOUETTE CLUE'),S('scene',trophy(),"WOMEN'S WORLD CUP · 1991")],
'd16':[S('scene',trophy(),'WHICH SPORT?'),S('scene',ball_base(),'NICKNAME CLUE'),S('scene',medal(),'TENNIS · 1988')],
'd17':[S('scene',track(),'MARATHON'),S('logo',crest('#bd3039',N,ball_base()),'LOGO CLUE · MLB'),S('scene',trophy(),'NBA MVP · 1955–56')],
'd18':[S('scene',wrestlers(),'SUMO ORIGINS'),S('scene',trophy(),'SUPER BOWL I'),S('scene',calendar(),'WIMBLEDON')],
'd19':[S('scene',jersey(N),'TOUR DE FRANCE'),S('scene',stadium(),'MLB BALLPARK'),S('scene',trophy(),'WORLD CUP · 1930')],
'd20':[S('scene',pins(),'BOWLING'),S('sil',mystery(car()),'SILHOUETTE CLUE'),S('scene',stadium(),'TRACK AND FIELD')],
'd21':[S('scene',stopwatch(),'NHL GAME'),S('logo',crest('#005a9c',W,ball_base()),'LOGO CLUE · MLB'),S('scene',ball_base(),'IRONMAN STREAK')],
'd22':[S('scene',ball_basket(),'ON THE COURT'),S('logo',crest('#002c5f',W,helmet()),'LOGO CLUE · NFL'),S('scene',trophy(),'WORLD CUP · 1966')],
'd23':[S('scene',clock24(),'24 HOURS OF LE MANS'),S('sil',mystery(ball_soccer()),'SILHOUETTE CLUE'),S('scene',swim(),'OLYMPICS · 1972')],
'd24':[S('scene',dartboard(),'DARTS'),S('logo',crest('#0080c6',Y,helmet()),'LOGO CLUE · NFL'),S('scene',ball_base(),'WORLD SERIES · 1956')],
'd25':[S('scene',bat_cricket(),'CRICKET ORIGINS'),S('scene',ball_soccer(),'WORLD CUP · 1986'),S('scene',medal(),'EMPIRE GAMES · 1930')],
'd26':[S('scene',golf(),'GOLF SCORING'),S('sil',mystery(ball_basket()),'SILHOUETTE CLUE'),S('scene',hurdles(),'110 M HURDLES')],
'd27':[S('scene',volleyball(),'VOLLEYBALL'),S('logo',crest('#d50a0a','#34302b',helmet()),'LOGO CLUE · NFL'),S('scene',wheelchair(),'PARALYMPICS · 1960')],
'd28':[S('scene',stadium(),'WHICH SPORT?'),S('scene',golf(),'NICKNAME CLUE'),S('scene',snowflake(),'WINTER OLYMPICS · 1972')],
'd29':[S('scene',goalposts(),'NFL SCORING'),S('sil',mystery(pole()),'SILHOUETTE CLUE'),S('scene',checkered(),'INDY 500 · 1911')],
'd30':[S('scene',car(),'F1 STREET RACE'),S('logo',crest('#4f2683',Y,helmet()),'LOGO CLUE · NFL'),S('scene',eightball(),'SNOOKER')],
'd31':[S('scene',swim(),'OLYMPIC POOL'),S('sil',mystery(ball_foot()),'SILHOUETTE CLUE'),S('scene',torch(),'PAN AM GAMES · 1951')],
'd32':[S('scene',scrum(),'WHICH SPORT?'),S('logo',crest('#0c2340','#fa4616',ball_base()),'LOGO CLUE · MLB'),S('scene',handball(),'HANDBALL · 1938')],
}
def card(icon,lbl):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 220" role="img" aria-label="Sports">'
     f'<rect x="3" y="3" width="354" height="214" rx="18" fill="{C}" stroke="{N}" stroke-width="5"/>'
     f'<path d="M3 21a18 18 0 0 1 18-18h318a18 18 0 0 1 18 18v17H3z" fill="{O}"/>'
     f'<text x="180" y="30" text-anchor="middle" font-family="{F}" font-size="20" letter-spacing="1.5" fill="{W}">{lbl}</text>'
     f'<circle cx="34" cy="190" r="40" fill="{Y}" opacity=".35"/><circle cx="330" cy="70" r="26" fill="{Y}" opacity=".35"/>'
     f'<g transform="translate(180 128)">{icon}</g></svg>')
os.makedirs('assets',exist_ok=True)
from collections import Counter; cnt=Counter()
for d,qs in Q.items():
    for i,(t,icon,lbl) in enumerate(qs):
        open(f'assets/sports-{d}-q{i+1}.svg','w').write(card(icon,lbl)); cnt[t]+=1
print(cnt)
# flags (public-domain designs)
open('assets/flag-japan.svg','w').write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" role="img" aria-label="Flag"><rect width="900" height="600" fill="#fff"/><circle cx="450" cy="300" r="180" fill="#BC002D"/><rect width="900" height="600" fill="none" stroke="#ccc" stroke-width="4"/></svg>')
open('assets/flag-canada.svg','w').write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9600 4800" role="img" aria-label="Flag"><path fill="#d52b1e" d="M0 0h2400l99 99h4602l99-99h2400v4800h-2400l-99-99h-4602l-99 99H0z"/><path fill="#fff" d="M2400 0h4800v4800h-4800zm2490 4430-45-863a95 95 0 0 1 111-98l859 151-116-320a65 65 0 0 1 20-73l941-762-212-99a65 65 0 0 1-34-79l186-572-542 115a65 65 0 0 1-73-38l-105-247-423 454a65 65 0 0 1-111-57l204-1052-327 189a65 65 0 0 1-91-27l-332-652-332 652a65 65 0 0 1-91 27l-327-189 204 1052a65 65 0 0 1-111 57l-423-454-105 247a65 65 0 0 1-73 38l-542-115 186 572a65 65 0 0 1-34 79l-212 99 941 762a65 65 0 0 1 20 73l-116 320 859-151a95 95 0 0 1 111 98l-45 863z"/></svg>')
# --- staged week-1 (m01) visuals: numbers only from the question text ---
def barchart(val,num,unit,ticks):
    w=int(240*val/ticks[-1]); g=f'<g transform="translate(-130 -50)">'
    for t in ticks:
        x=int(240*t/ticks[-1]); g+=f'<path d="M{x} 0V96" stroke="{N}" stroke-opacity=".2" stroke-width="2"/><text x="{x}" y="112" text-anchor="middle" font-family="{F}" font-size="12" fill="{N}">{t:,}</text>'
    g+=f'<rect y="26" width="{w}" height="44" rx="6" fill="{O}" stroke="{N}" stroke-width="3"/><text x="{w-8}" y="56" text-anchor="end" font-family="{F}" font-size="24" fill="{W}">{num}</text><path d="M0 0V96" stroke="{N}" stroke-width="4"/><text x="0" y="16" font-family="{F}" font-size="13" letter-spacing="1" fill="{N}">{unit}</text></g>'
    return g
def field(): # generic end-zone play diagram
    return (f'<rect x="-130" y="-56" width="260" height="112" rx="6" fill="#4f9a4f" stroke="{N}" stroke-width="4"/><rect x="70" y="-56" width="60" height="112" fill="#3c7d3c"/>'
     +''.join(f'<path d="M{x}-56v112" stroke="{W}" stroke-width="2" opacity=".7"/>' for x in (-90,-50,-10,30,70))
     +f'<circle cx="-40" cy="20" r="9" fill="{N}"/><path d="M-40 20c20 10 40 10 54-6" stroke="{Y}" stroke-width="3" stroke-dasharray="6 5" fill="none"/><path d="M-30 18Q40-70 104-30" stroke="{W}" stroke-width="3" stroke-dasharray="6 5" fill="none"/><circle cx="104" cy="-34" r="10" fill="{O}" stroke="{N}" stroke-width="2"/><text x="104" y="-30" text-anchor="middle" font-family="{F}" font-size="12" fill="{W}">?</text>')
def diamond(): # generic ballpark homer arc
    return (f'<path d="M0 58L-110-40A150 150 0 0 1 110-40z" fill="#4f9a4f" stroke="{N}" stroke-width="4"/><path d="M0 50l-34-34 34-34 34 34z" fill="#c9905a"/><path d="M0 50l-34-34 34-34 34 34z" fill="none" stroke="{W}" stroke-width="3"/>'
     f'<path d="M0 50Q70-60 128-58" stroke="{Y}" stroke-width="4" stroke-dasharray="7 5" fill="none"/><circle cx="128" cy="-58" r="7" fill="{W}" stroke="{N}" stroke-width="2"/>')
def swatch(a,b): return f'<rect x="-120" y="-50" width="120" height="100" rx="10" fill="{a}" stroke="{N}" stroke-width="4"/><rect x="0" y="-50" width="120" height="100" rx="10" fill="{b}" stroke="{N}" stroke-width="4"/><text y="22" text-anchor="middle" font-family="{F}" font-size="60" fill="{N}" stroke="{W}" stroke-width="2">?</text>'
def jersey7(): return f'<path d="M-30-56h60l40 24-16 30-16-9v68h-76v-68l-16 9-16-30z" fill="{O}" stroke="{N}" stroke-width="4"/><text y="34" text-anchor="middle" font-family="{F}" font-size="64" fill="{N}">7</text>'
M={'d1':(barchart(18355,'18,355','CAREER RUSHING YARDS',[0,5000,10000,15000,20000]),'NFL CAREER RECORD'),
   'd2':(field(),'JAN 1982 · NFC TITLE GAME'),'d3':(swatch('#c8102e','#ffffff'),'TEAM COLOURS · NHL'),
   'd4':(jersey7(),'JERSEY NUMBER · DENVER'),'d5':(barchart(5714,'5,714','CAREER STRIKEOUTS',[0,2000,4000,6000]),'MLB CAREER RECORD'),
   'd6':(diamond(),'1988 WORLD SERIES · GAME 1'),'d7':(swatch('#041e42','#ff4c00'),'TEAM COLOURS · NHL')}
for d,(icon,lbl) in M.items(): open(f'assets/sports-m01-{d}-q2.svg','w').write(card(icon,lbl))
print('m01',len(M))
def jerseyn(n): return jersey7().replace('>7</text>',f'>{n}</text>')
def diamond_lf(): return f'<g transform="scale(-1 1)">{diamond()}</g>'
def field2(): return field().replace('M-30 18Q40-70 104-30','M-30 18Q20-50 40-10').replace('cx="104" cy="-34"','cx="40" cy="-6"').replace('x="104" y="-30"','x="40" y="-2"')+f'<path d="M48-2H120" stroke="{O}" stroke-width="4" marker-end="none"/><path d="M112-10l10 8-10 8" fill="none" stroke="{O}" stroke-width="4"/>'
M2={'d8':(jerseyn(32),'JERSEY NUMBER · DODGERS LHP'),'d9':(barchart(4256,'4,256','CAREER HITS',[0,1000,2000,3000,4000,5000]),'MLB CAREER RECORD'),
 'd10':(field2(),'1972 AFC PLAYOFF'),'d11':(swatch('#00205B','#ffffff'),'TEAM COLOURS · NHL'),'d12':(jerseyn(4),'JERSEY NUMBER · BOSTON D'),
 'd13':(barchart(801,'801','CAREER NHL GOALS · RETIRED 1980',[0,200,400,600,800,1000]),'NHL CAREER RECORD'),'d14':(diamond_lf(),'1960 WORLD SERIES · GAME 7')}
for d,(icon,lbl) in M2.items(): open(f'assets/sports-m01-{d}-q2.svg','w').write(card(icon,lbl))
print('m01 wk2',len(M2))
