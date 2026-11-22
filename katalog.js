'use strict';
/* Fachkatalog Fliesenleger: [Gruppe, Name, Standard-Einheit, Schreibvarianten/Synonyme (mit | getrennt)]
   Schreibweisen mit/ohne Leerzeichen oder Bindestrich werden automatisch erkannt (z. B. "Fliesen Kleber"). */
const KATALOG = {
  mat: [
    ['Fliesen & Platten','Bodenfliesen','m²','Bodenfliese|Bodenplatten|Bodenbelag'],
    ['Fliesen & Platten','Wandfliesen','m²','Wandfliese|Wandplatten|Wandbelag'],
    ['Fliesen & Platten','Fliesen','m²','Fliese'],
    ['Fliesen & Platten','Feinsteinzeug','m²','Feinsteinzeugfliesen|Steinzeug|Steinzeugfliesen'],
    ['Fliesen & Platten','Großformatplatten','m²','Großformat|Grossformat|Großformatfliesen'],
    ['Fliesen & Platten','Mosaikfliesen','m²','Mosaik|Glasmosaik|Mosaikfliese'],
    ['Fliesen & Platten','Natursteinplatten','m²','Naturstein|Natursteinfliesen|Marmorplatten|Granitplatten'],
    ['Fliesen & Platten','Terrassenplatten','m²','Terrassenplatte|Außenplatten|Aussenplatten'],
    ['Fliesen & Platten','Sockelfliesen','lfm','Sockelfliese|Sockelleisten|Sockel'],
    ['Fliesen & Platten','Bordüre','lfm','Bordüren|Borduere|Dekorleiste|Dekorleisten'],

    ['Kleber & Mörtel','Fliesenkleber','Sack','Kleber|Dünnbettmörtel|Dünnbettkleber|Fliesenmörtel'],
    ['Kleber & Mörtel','Flexkleber','Sack','Flexmörtel'],
    ['Kleber & Mörtel','Natursteinkleber','Sack','Marmorkleber'],
    ['Kleber & Mörtel','Mittelbettmörtel','Sack','Mittelbettkleber'],
    ['Kleber & Mörtel','Schnellkleber','Sack','Schnellmörtel'],
    ['Kleber & Mörtel','Zementmörtel','Sack','Mörtel|Maurermörtel'],

    ['Untergrund & Estrich','Ausgleichsmasse','Sack','Nivelliermasse|Nivellierspachtel|Bodenausgleich|Spachtelmasse'],
    ['Untergrund & Estrich','Estrichmörtel','Sack','Estrich|Zementestrich|Fertigestrich'],
    ['Untergrund & Estrich','Zement','Sack',''],
    ['Untergrund & Estrich','Sand','kg','Estrichsand|Quarzsand'],
    ['Untergrund & Estrich','Entkopplungsmatte','m²','Ditra|Entkopplung|Entkopplungsbahn'],
    ['Untergrund & Estrich','Trittschalldämmung','m²','Trittschalldaemmung|Dämmung|Dämmplatten'],
    ['Untergrund & Estrich','Randdämmstreifen','lfm','Randstreifen|Randdaemmstreifen'],
    ['Untergrund & Estrich','Bauplatten','Stk','Bauplatte|Wedi|Wediplatten|Fermacell|Gipskartonplatten'],
    ['Untergrund & Estrich','Armierungsgewebe','m²','Gewebe|Glasfasergewebe|Armierung'],

    ['Fugen & Silikon','Fugenmasse','kg','Fugenmörtel|Fugenmoertel|Fuge|Fugen|Fugenfüller'],
    ['Fugen & Silikon','Epoxidfugenmörtel','kg','Epoxidfuge|Epoxyfuge|Epoxid'],
    ['Fugen & Silikon','Silikon','Tube','Sanitärsilikon|Sanitaersilikon|Silicon|Fugensilikon|Kartusche'],
    ['Fugen & Silikon','Acryl','Tube','Acrylfuge|Acrylkartusche'],

    ['Abdichtung & Grund','Grundierung','l','Tiefengrund|Haftgrund|Primer|Voranstrich|Tiefengrundierung|Quarzgrund'],
    ['Abdichtung & Grund','Dichtschlämme','kg','Dichtschlaemme|Dichtungsschlämme|Abdichtung|Verbundabdichtung'],
    ['Abdichtung & Grund','Flüssigfolie','kg','Fluessigfolie|Flüssigabdichtung|Flüssigkunststoff'],
    ['Abdichtung & Grund','Dichtmasse','l','Dichtungsmasse|Abdichtmasse'],
    ['Abdichtung & Grund','Dichtband','lfm','Dichtbänder|Dichtungsband|Abdichtband'],
    ['Abdichtung & Grund','Dichtmanschetten','Stk','Dichtmanschette|Manschette|Wandmanschette|Bodenmanschette'],
    ['Abdichtung & Grund','Dichtecken','Stk','Dichtecke|Innenecken|Außenecken'],

    ['Profile & Zubehör','Schlüterschiene','lfm','Eckprofil|Eckschiene|Abschlussprofil|Abschlussschiene|Kantenprofil|Profil|Winkelprofil|Schiene'],
    ['Profile & Zubehör','Dehnungsfugenprofil','lfm','Dehnfuge|Dehnungsfuge|Bewegungsfuge|Dehnfugenprofil'],
    ['Profile & Zubehör','Fliesenkreuze','Pkt','Fliesenkreuz|Fugenkreuze|Abstandshalter|Kreuze'],
    ['Profile & Zubehör','Nivelliersystem','Pkt','Verlegehilfe|Nivellierlaschen|Zuganker|Laschen|Keile'],
    ['Profile & Zubehör','Duschrinne','Stk','Duschrinnen|Bodenrinne|Ablaufrinne|Entwässerungsrinne'],
    ['Profile & Zubehör','Bodenablauf','Stk','Bodenabläufe|Bodeneinlauf|Ablauf'],
    ['Profile & Zubehör','Revisionsöffnung','Stk','Revisionsklappe|Revisionstür|Revisionsoeffnung'],

    ['Reinigung & Schutz','Abdeckfolie','m²','Schutzfolie|Abdeckvlies|Malervlies|Folie|Abdeckpapier|Schutzvlies'],
    ['Reinigung & Schutz','Abklebeband','Stk','Kreppband|Malerkrepp|Krepp|Klebeband'],
    ['Reinigung & Schutz','Reinigungsmittel','l','Zementschleierentferner|Fliesenreiniger|Reiniger|Schleierentferner|Grundreiniger'],
    ['Reinigung & Schutz','Imprägnierung','l','Impraegnierung|Imprägniermittel|Versiegelung|Steinimprägnierung']
  ],
  ger: [
    ['Schneiden','Nassschneider','Std','Nassschneidegerät|Fliesennassschneider|Fliesenschneidemaschine|Tischsäge|Nassfräse|Steinsäge|Fliesensäge|Sägetisch'],
    ['Schneiden','Fliesenschneider','Std','Schneidegerät|Handschneider|Schneidmaschine|Fliesenschneidgerät|Montolit|Rubi'],
    ['Schneiden','Winkelschleifer','Std','Flex|Trennschleifer|Winkelschleifmaschine|Flexgerät|Schleifer'],
    ['Schneiden','Fliesenzange','Std','Knabberzange|Bohrzange|Fliesenbrecher|Zange'],

    ['Bohren & Schlagen','Bohrhammer','Std','Hilti|Kombihammer|Schlagbohrer|Meißelhammer|Abbruchhammer|Stemmhammer|Schlagbohrmaschine'],
    ['Bohren & Schlagen','Bohrmaschine','Std','Akkubohrer|Bohrer'],
    ['Bohren & Schlagen','Akkuschrauber','Std','Schlagschrauber'],
    ['Bohren & Schlagen','Diamantbohrer','Std','Diamantbohrkrone|Fliesenbohrer|Lochsäge|Bohrkrone|Dosensenker|Steckdosenbohrer'],
    ['Bohren & Schlagen','Kernbohrmaschine','Std','Kernbohrer|Kernbohrgerät|Kernbohrung'],

    ['Mischen & Verlegen','Rührgerät','Std','Rührwerk|Rührer|Mörtelmischer|Mischer|Rührstab|Quirl|Rührmaschine|Paddelmischer|Handrührer|Rühr gerät'],
    ['Mischen & Verlegen','Zwangsmischer','Std','Betonmischer|Mörtelmaschine|Mischmaschine|Freifallmischer'],
    ['Mischen & Verlegen','Zahnspachtel','Std','Glättkelle|Kelle|Spachtel|Traufel'],
    ['Mischen & Verlegen','Fugbrett','Std','Fugenbrett|Fugenkelle|Fugengummi|Gummiwischer|Fugenwischer'],
    ['Mischen & Verlegen','Gummihammer','Std','Fäustel|Fliesenhammer|Klopfer'],
    ['Mischen & Verlegen','Saugheber','Std','Fliesensauger|Vakuumheber|Plattenheber|Saugplatte|Plattenträger|Saugnapf'],

    ['Messen & Nivellieren','Rotationslaser','Std','Laser|Linienlaser|Kreuzlinienlaser|Nivelliergerät|Baulaser'],
    ['Messen & Nivellieren','Wasserwaage','Std','Richtscheit|Alulatte|Aluminiumlatte|Setzlatte|Richtlatte|Wasserwaagen'],
    ['Messen & Nivellieren','Messgerät','Std','Feuchtemessgerät|CM-Gerät|Restfeuchtemessgerät|Feuchtigkeitsmessgerät'],

    ['Schleifen & Fräsen','Estrichschleifer','Std','Bodenschleifer|Bodenschleifmaschine|Schleifmaschine|Betonschleifer'],
    ['Schleifen & Fräsen','Fräse','Std','Wandfräse|Schlitzfräse|Mauernutfräse|Nutfräse|Schlitzer'],

    ['Transport & Gerüst','Rollgerüst','Tage','Gerüst|Fahrgerüst|Arbeitsgerüst|Baugerüst|Arbeitsbühne|Podest|Hubbühne|Scherenbühne'],
    ['Transport & Gerüst','Leiter','Tage','Stehleiter|Anlegeleiter|Trittleiter|Teleskopleiter|Klappleiter|Mehrzweckleiter|Tritt'],
    ['Transport & Gerüst','Sackkarre','Std','Schubkarre|Karre|Handwagen|Plattenwagen|Plattenkarre|Hubwagen|Stapler|Transportwagen'],
    ['Transport & Gerüst','Bauaufzug','Tage','Außenaufzug|Materialaufzug|Schrägaufzug|Lastenaufzug|Aufzug'],
    ['Transport & Gerüst','Kran','Std','Baukran|Autokran|Minikran'],

    ['Reinigen, Trocknen & Strom','Bausauger','Std','Staubsauger|Industriesauger|Nasssauger|Nass-Trockensauger|Baustaubsauger'],
    ['Reinigen, Trocknen & Strom','Bautrockner','Tage','Trockner|Luftentfeuchter|Entfeuchter|Heizlüfter|Bauheizer|Heizgerät|Heizstrahler'],
    ['Reinigen, Trocknen & Strom','Kompressor','Std','Druckluft|Luftkompressor'],
    ['Reinigen, Trocknen & Strom','Stromaggregat','Std','Generator|Aggregat|Baustromverteiler|Verteiler|Kabeltrommel|Verlängerungskabel'],
    ['Reinigen, Trocknen & Strom','Wasserpumpe','Std','Tauchpumpe|Schmutzwasserpumpe|Pumpe'],
    ['Reinigen, Trocknen & Strom','Hochdruckreiniger','Std','Kärcher|Dampfreiniger'],

    ['Sonstiges','Rüttelplatte','Std','Rüttler|Vibrationsplatte|Plattenrüttler|Verdichter|Stampfer|Flaschenrüttler|Innenrüttler|Rüttelmaschine']
  ]
};
