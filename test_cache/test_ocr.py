import os
from utils.ocr.image_ocr import ImageOCR

def test_ocr():
    # 获取当前目录下的test.png
    current_dir = os.path.dirname(os.path.abspath(__file__))
    image_path = os.path.join(current_dir, 'image.png')
    
    # 确认文件存在
    if not os.path.exists(image_path):
        print(f"错误：找不到文件 {image_path}")
        return
    
    # 创建OCR实例
    ocr = ImageOCR()
    
    # 测试通用OCR API
    print("使用通用OCR API进行测试...")
    params = {
        'rec_mode': 'auto',  # 可选: 'auto', 'document', 'formula'
        'enable_img_rot': True,  # 是否启用图片旋转校正
        'inline_formula_wrapper': ['$', '$'],  # 行内公式包装
        'isolated_formula_wrapper': ['$$', '$$']  # 独立公式包装
    }
    
    result = ocr.image_to_text(
        image_path, 
        use_common_ocr=True,  # 使用通用OCR
        ocr_params=params
    )
    text = ocr.get_text_content(result)
    print("通用OCR结果:", text)
    print("完整返回:", result)
    print("-" * 50)
    
    # 测试公式OCR API
    print("使用公式OCR API进行测试...")
    result_formula = ocr.image_to_text(
        image_path, 
        use_common_ocr=False  # 使用公式OCR
    )
    text_formula = ocr.get_text_content(result_formula)
    print("公式OCR结果:", text_formula)
    print("完整返回:", result_formula)

if __name__ == "__main__":
    test_ocr()