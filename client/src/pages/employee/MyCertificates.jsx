import React, { useState, useEffect } from 'react'
import { Card, Tag, Button, Row, Col, message, Empty, Spin } from 'antd'
import { DownloadOutlined, TrophyOutlined } from '@ant-design/icons'
import request from '../../utils/request'

const statusMap = {
  valid: { text: '有效', color: 'green' },
  expired: { text: '过期', color: 'red' }
}

export default function MyCertificates() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await request.get('/certificates/my')
      const list = res.data || []
      const today = new Date()
      const processedList = list.map(item => {
        if (item.expire_date && new Date(item.expire_date) < today) {
          return { ...item, status: 'expired' }
        }
        return { ...item, status: 'valid' }
      })
      setData(processedList)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (id) => {
    try {
      const token = localStorage.getItem('token')
      const link = document.createElement('a')
      link.href = `/api/certificates/download/${id}`
      link.target = '_blank'
      link.download = ''
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      message.success('开始下载')
    } catch (e) {
      message.error('下载失败')
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h2 className="page-title">我的证书</h2>
        </div>
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">我的证书</h2>
      </div>

      <Card>
        {data.length === 0 ? (
          <Empty description="暂无证书" />
        ) : (
          <Row gutter={[24, 24]}>
            {data.map(item => (
              <Col xs={24} sm={12} lg={8} key={item.id}>
                <Card
                  hoverable
                  style={{
                    background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)',
                    borderRadius: 8,
                    position: 'relative'
                  }}
                  bodyStyle={{ padding: 24 }}
                  actions={[
                    <Button
                      type="primary"
                      icon={<DownloadOutlined />}
                      onClick={() => handleDownload(item.id)}
                      block
                    >
                      下载PDF
                    </Button>
                  ]}
                >
                  <div style={{ position: 'absolute', top: 16, right: 16 }}>
                    <Tag color={statusMap[item.status]?.color}>
                      {statusMap[item.status]?.text}
                    </Tag>
                  </div>

                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <TrophyOutlined style={{ fontSize: 48, color: '#2c5aa0' }} />
                  </div>

                  <h3 style={{
                    textAlign: 'center',
                    color: '#2c5aa0',
                    marginBottom: 16,
                    fontSize: 16,
                    fontWeight: 'bold'
                  }}>
                    {item.name}
                  </h3>

                  <div style={{ fontSize: 13, color: '#666', lineHeight: 2 }}>
                    <p style={{ margin: 0 }}>
                      <strong>证书编号：</strong>{item.certificate_no}
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>课程名称：</strong>{item.course_name}
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>颁发日期：</strong>{item.issue_date}
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>有效期至：</strong>{item.expire_date || '长期有效'}
                    </p>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>
    </div>
  )
}
