/**
 * Curated set of real randomized controlled trials conducted on athletes,
 * shown when the user taps "Makaleleri Getir" in the Literatür module.
 *
 * Source: PubMed (NCBI). Each entry carries its real PMID + DOI so the links
 * resolve to the original article. Metadata was retrieved from PubMed.
 */

export interface CuratedArticle {
  title: string;
  authors: string[];
  year: number;
  journal: string;
  doi: string;
  pmid: string;
  topic: string;
  abstract: string;
}

export const CURATED_ARTICLES: CuratedArticle[] = [
  {
    title:
      "The Effect of Strength and Balance Training on Kinesiophobia, Ankle Instability, Function, and Performance in Elite Adolescent Soccer Players with Functional Ankle Instability: A Prospective Cluster Randomized Controlled Trial",
    authors: ["Park HS", "Oh JK", "Kim JY", "Yoon JH"],
    year: 2024,
    journal: "Journal of Sports Science & Medicine",
    doi: "10.52082/jssm.2024.593",
    pmid: "39228771",
    topic: "Sakatlık Önleme",
    abstract:
      "Fonksiyonel ayak bileği instabilitesi olan elit adölesan futbolcularda 6 haftalık kuvvet ve denge antrenmanı; kinezyofobi, ayak bileği stabilitesi ve performansı anlamlı ölçüde geliştirdi. Denge antrenmanı kinezyofobiyi azaltmada tek başına kuvvet antrenmanına üstündü.",
  },
  {
    title:
      "Effects of Eccentric-Oriented Strength Training on Return to Sport Criteria in Late-Stage Anterior Cruciate Ligament (ACL)-Reconstructed Professional Team Sport Players",
    authors: ["Stojanović MDM", "Andrić N", "Mikić M", "Vukosav N"],
    year: 2023,
    journal: "Medicina (Kaunas)",
    doi: "10.3390/medicina59061111",
    pmid: "37374316",
    topic: "Rehabilitasyon",
    abstract:
      "ACL rekonstrüksiyonu sonrası geç dönemde 6 haftalık eksantrik odaklı (flywheel) kuvvet antrenmanı; bacak kuvveti ve dikey/yatay sıçrama performansında geleneksel kuvvet antrenmanına göre daha iyi sonuçlar verdi.",
  },
  {
    title:
      "Effects of Plyometric vs. Strength Training on Strength, Sprint, and Functional Performance in Soccer Players: A Randomized Controlled Trial",
    authors: ["Hasan S"],
    year: 2023,
    journal: "Scientific Reports",
    doi: "10.1038/s41598-023-31375-4",
    pmid: "36918731",
    topic: "Kuvvet & Güç",
    abstract:
      "Erkek futbolcularda 8 haftalık karşılaştırma: kuvvet antrenmanı, izometrik kuvvet, sprint ve alt ekstremite fonksiyonel performansını geliştirmede pliometrik antrenmandan daha etkili bulundu.",
  },
  {
    title:
      "Effects of Running-Specific Strength Training, Endurance Training, and Concurrent Training on Recreational Endurance Athletes' Performance and Selected Anthropometric Parameters",
    authors: ["Prieto-González P", "Sedlacek J"],
    year: 2022,
    journal: "Int. J. Environmental Research and Public Health",
    doi: "10.3390/ijerph191710773",
    pmid: "36078489",
    topic: "Dayanıklılık",
    abstract:
      "12 haftalık ATR blok periyotlaması ile koşuya özgü kuvvet, dayanıklılık ve eş zamanlı (concurrent) antrenman karşılaştırıldı. Eş zamanlı antrenman, ardışık olmayan günlerde yapıldığında hem kuvvet hem dayanıklılık adaptasyonlarını korudu.",
  },
  {
    title:
      "Effects of Flexibility and Strength Training on Peak Hamstring Musculotendinous Strains During Sprinting",
    authors: ["Wan X", "Li S", "Best TM", "Liu H", "Li H", "Yu B"],
    year: 2020,
    journal: "Journal of Sport and Health Science",
    doi: "10.1016/j.jshs.2020.08.001",
    pmid: "32795623",
    topic: "Sakatlık Önleme",
    abstract:
      "Rekreasyonel erkek sporcularda 8 haftalık esneklik veya kuvvet antrenmanı, sprint sırasında hamstring kas-tendon gerilim tepe değerlerini anlamlı olarak azaltarak hamstring sakatlık riskini düşürebilir.",
  },
  {
    title:
      "Effects of 4-Week Creatine Supplementation Combined with Complex Training on Muscle Damage and Sport Performance",
    authors: ["Wang CC", "Fang CC", "Lee YH", "Yang MT", "Chan KH"],
    year: 2018,
    journal: "Nutrients",
    doi: "10.3390/nu10111640",
    pmid: "30400221",
    topic: "Beslenme & Ergojenik",
    abstract:
      "Patlayıcı güç sporcularında 4 haftalık kompleks antrenman ile birlikte kreatin takviyesi; maksimal kas kuvvetini artırdı ve antrenman sırasında kas hasarını (kreatin kinaz) azalttı.",
  },
];
