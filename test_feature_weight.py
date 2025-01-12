import utils.text_attachment.language_processor.feature_weight_updater as feature_weight_updater
updater = feature_weight_updater.FeatureWeightDictUpdater()
weight = updater.lookup_term_weight("", "zh")  # 查找英语中"computer"的权重
print(weight)
